import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { darkLyricsProgress } from "@/lib/rendering/remotion";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const session = await createSessionClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    const parsed = z.object({ videoId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid video request" }, { status: 400 });
    // Never use a render ID, provider, bucket, or AWS function from the browser.
    const { data: video, error } = await supabase.from("videos").select("*")
      .eq("id", parsed.data.videoId).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (video.status === "done" || video.status === "error") {
      return NextResponse.json({ status: video.status, url: video.render_url });
    }
    if (video.status !== "rendering" || !video.render_id) {
      return NextResponse.json({ status: video.status });
    }

    let status = "rendering";
    let url: string | null = null;
    if (video.render_provider === "remotion") {
      if (!video.render_bucket || !video.render_function || !video.render_region) {
        throw new Error("Remotion render metadata is missing");
      }
      const progress = await darkLyricsProgress(video);
      if (progress.fatalErrorEncountered) {
        console.error("Remotion render failed:", progress.errors);
        status = "error";
      } else if (progress.done && progress.outputFile) {
        status = "done";
        url = progress.outputFile;
      }
    } else if (!video.render_provider && video.clip_style === "dark-solid") {
      // Old renders lost their bucket name. Do not query Creatomate with an AWS ID.
      return NextResponse.json({ error: "This older render is missing tracking information. Create a new video." }, { status: 409 });
    } else if (!video.render_provider || video.render_provider === "creatomate") {
      const response = await fetch(`https://api.creatomate.com/v1/renders/${encodeURIComponent(video.render_id)}`, {
        headers: { Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Creatomate status failed (HTTP ${response.status})`);
      const render = await response.json();
      if (render.status === "succeeded" && render.url) { status = "done"; url = render.url; }
      if (render.status === "failed") status = "error";
    } else {
      throw new Error("Unknown render provider");
    }

    if (status !== "rendering") {
      const { error: updateError } = await supabase.from("videos")
        .update({ status, render_url: url }).eq("id", video.id).eq("user_id", user.id)
        .eq("render_id", video.render_id).eq("status", "rendering");
      if (updateError) throw updateError;
    }
    return NextResponse.json({ status, url });
  } catch (err) {
    // A transient polling error must not permanently fail a valid render.
    console.error("Check render error:", err);
    return NextResponse.json({ error: "Could not check render status" }, { status: 500 });
  }
}
