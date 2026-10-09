import { getRenderProgress, renderMediaOnLambda } from "@remotion/lambda/client";
import type { DarkLyricsProps } from "../../remotion/DarkLyrics";
import { durationInFrames } from "./timing";

function config() {
  const region = process.env.REMOTION_AWS_REGION ?? "us-east-1";
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;
  if (!functionName || !serveUrl) throw new Error("Missing REMOTION_FUNCTION_NAME or REMOTION_SERVE_URL");
  const maxConcurrency = Number(process.env.REMOTION_MAX_CONCURRENCY ?? 200);
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 2 || maxConcurrency > 200) {
    throw new Error("REMOTION_MAX_CONCURRENCY must be an integer from 2 to 200");
  }
  return { region: region as Parameters<typeof renderMediaOnLambda>[0]["region"], functionName, serveUrl, maxConcurrency };
}

// Validate before reserving credits or doing transcription. A missing local
// setting is a known pre-submission failure, not an uncertain provider result.
export function assertDarkLyricsConfigured() {
  config();
}

export async function startDarkLyricsRender(inputProps: DarkLyricsProps) {
  const { region, functionName, serveUrl, maxConcurrency } = config();
  const result = await renderMediaOnLambda({
    region, functionName, serveUrl,
    composition: "DarkLyrics", inputProps,
    codec: "h264", imageFormat: "jpeg", maxRetries: 1,
    // Remotion caps a render at 200 functions. Fixed 20-frame batches exceed
    // that limit for songs longer than 133 seconds at 30 fps.
    framesPerLambda: Math.max(20, Math.ceil(durationInFrames(inputProps.songDuration) / maxConcurrency)),
    concurrencyPerLambda: 1,
    outName: `dark-lyrics-${crypto.randomUUID()}.mp4`,
    timeoutInMilliseconds: 120000,
  });
  if (!result.renderId || !result.bucketName) throw new Error("Incomplete Remotion render response");
  return { id: result.renderId, bucketName: result.bucketName, functionName, region };
}

export async function darkLyricsProgress(job: {
  render_id: string; render_bucket: string; render_function: string; render_region: string;
}) {
  return getRenderProgress({
    renderId: job.render_id, bucketName: job.render_bucket, functionName: job.render_function,
    region: job.render_region as Parameters<typeof getRenderProgress>[0]["region"],
  });
}
