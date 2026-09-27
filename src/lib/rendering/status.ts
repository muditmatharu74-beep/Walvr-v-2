import { darkLyricsProgress } from "./remotion";
export type RenderJob = {
  id: string; user_id: string; status: string; render_id: string | null;
  render_provider: string | null; render_bucket: string | null;
  render_function: string | null; render_region: string | null;
  clip_style?: string | null;
};
// Shared by owner polling and recovery. Network errors never mean render failure.
export async function readRenderStatus(video: RenderJob) {
  if (!video.render_id) throw new Error("Missing render ID");
    let status = "rendering";
    let url: string | null = null;
    if (video.render_provider === "remotion") {
      if (!video.render_bucket || !video.render_function || !video.render_region) {
        throw new Error("Remotion render metadata is missing");
      }
      const progress = await darkLyricsProgress({ render_id: video.render_id!, render_bucket: video.render_bucket, render_function: video.render_function, render_region: video.render_region });
      if (progress.fatalErrorEncountered) {
        console.error("Remotion render failed:", progress.errors);
        status = "error";
      } else if (progress.done && progress.outputFile) {
        status = "done";
        url = progress.outputFile;
      }
    } else if (!video.render_provider && video.clip_style === "dark-solid") {
      // Old renders lost their bucket name. Do not query Creatomate with an AWS ID.
      throw new Error("Legacy Dark Lyrics tracking missing");
    } else if (!video.render_provider || video.render_provider === "creatomate") {
      const response = await fetch(`https://api.creatomate.com/v1/renders/${encodeURIComponent(video.render_id!)}`, {
        headers: { Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Creatomate status failed (HTTP ${response.status})`);
      const render = await response.json();
      if (render.status === "succeeded" && render.url) { status = "done"; url = render.url; }
      if (render.status === "failed") status = "error";
    } else {
      throw new Error("Unknown render provider");
    }

  return { status, url };
}
