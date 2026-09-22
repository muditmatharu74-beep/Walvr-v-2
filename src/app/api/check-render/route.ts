import { createClient } from "@supabase/supabase-js";
import { getRenderProgress } from "@remotion/lambda/client";
import { NextResponse } from "next/server";
import { verifyRenderMetadata } from "@/lib/render-signature";
import { createClient as createSessionClient } from "@/lib/supabase/server";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request: Request) {
  try {
    const session = await createSessionClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
    const { videoId } = await request.json();
    if (typeof videoId !== "string") return NextResponse.json({ error: "Missing video ID" }, { status: 400 });
    // Never accept a caller-supplied render ID or bucket. Resolve the owned record first.
    const { data: video, error } = await supabase.from("videos")
      .select("id, status, render_id, render_url, analysis, clip_style")
      .eq("id", videoId).eq("user_id", user.id).single();
    if (error || !video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    if (video.status === "done") return NextResponse.json({ status: "done", url: video.render_url });
    if (video.status === "error") return NextResponse.json({ status: "error" });
    if (!video.render_id) return NextResponse.json({ status: video.status });

    let status = "rendering";
    let url: string | null = null;
    const metadata = video.analysis?.render;
    if (metadata?.provider === "remotion") {
      if (!verifyRenderMetadata({ videoId: video.id, userId: user.id, renderId: video.render_id }, metadata)) {
        throw new Error("Render tracking signature is invalid");
      }
      if (!metadata.bucketName || !metadata.functionName || typeof metadata.region !== "string") {
        throw new Error("Stored Remotion render details are incomplete");
      }
      const progress = await getRenderProgress({
        renderId: video.render_id, bucketName: metadata.bucketName,
        functionName: metadata.functionName, region: metadata.region,
      });
      if (progress.fatalErrorEncountered) {
        console.error("Remotion render failed:", video.id, progress.errors);
        status = "error";
      } else if (progress.done) {
        if (!progress.outputFile) throw new Error("Completed Remotion render has no output URL");
        status = "done";
        url = progress.outputFile;
      }
    } else if (video.clip_style === "dark-solid" && !metadata) {
      // Old Remotion jobs did not save their bucket. Do not send these IDs to Creatomate.
      status = "error";
      console.error("Legacy Dark Lyrics render has no tracking details:", video.id);
    } else {
      const res = await fetch('https://api.creatomate.com/v1/renders/' + encodeURIComponent(video.render_id), {
        headers: { Authorization: 'Bearer ' + process.env.CREATOMATE_API_KEY },
      });
      if (!res.ok) throw new Error("Creatomate status failed: HTTP " + res.status);
      const render = await res.json();
      if (render.status === "succeeded") {
        if (!render.url) throw new Error("Completed Creatomate render has no output URL");
        status = "done";
        url = render.url;
      } else if (render.status === "failed") status = "error";
    }
    if (status !== "rendering") {
      const { data: settled, error: updateError } = await supabase.rpc("settle_video_credits", {
        p_user_id: user.id, p_video_id: video.id, p_status: status, p_render_id: video.render_id, p_url: url,
      });
      if (updateError) throw updateError;
      status = settled.status;
      url = settled.url;
    }
    return NextResponse.json({ status, ...(url ? { url } : {}) });
  } catch (err) {
    console.error("Check render error:", err);
    return NextResponse.json({ error: "Unable to check render status" }, { status: 500 });
  }
}
