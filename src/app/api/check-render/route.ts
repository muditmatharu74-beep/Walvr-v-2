import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { readRenderStatus } from "@/lib/rendering/status";

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

    if (!video.render_provider && video.clip_style === "dark-solid") {
      return NextResponse.json({ error: "This older render is missing tracking information. Create a new video." }, { status: 409 });
    }
    let { status, url } = await readRenderStatus(video);

    if (status !== "rendering") {
      const { data: settled, error: updateError } = await supabase.rpc("settle_video_credits", {
        p_user_id: user.id, p_video_id: video.id, p_status: status, p_render_id: video.render_id, p_url: url,
      });
      if (updateError) throw updateError;
      status = settled.status;
      url = settled.url;
    }
    return NextResponse.json({ status, url });
  } catch (err) {
    // A transient polling error must not permanently fail a valid render.
    console.error("Check render error:", err);
    return NextResponse.json({ error: "Could not check render status" }, { status: 500 });
  }
}
