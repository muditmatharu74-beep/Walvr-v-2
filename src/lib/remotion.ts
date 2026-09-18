import { type AwsRegion, renderMediaOnLambda } from "@remotion/lambda/client";
import { getSongDuration } from "./render-settings";
import type { DarkLyricsProps } from "../remotion/DarkLyrics";

export function getRemotionConfig() {
  const region = process.env.REMOTION_AWS_REGION || "us-east-1";
  if (!/^([a-z]{2})-[a-z]+-\d+$/.test(region)) {
    throw new Error("Invalid REMOTION_AWS_REGION");
  }
  const functionName = process.env.REMOTION_FUNCTION_NAME;
  const serveUrl = process.env.REMOTION_SERVE_URL;
  if (!functionName || !serveUrl) throw new Error("Missing REMOTION_FUNCTION_NAME or REMOTION_SERVE_URL");
  return { region: region as AwsRegion, functionName, serveUrl };
}

export async function startRemotionRender(props: DarkLyricsProps) {
  getSongDuration(props.songDuration);
  const config = getRemotionConfig();
  // Invoke Lambda directly: no self-request through deployment protection or middleware.
  const result = await renderMediaOnLambda({
    ...config, composition: "DarkLyrics", inputProps: props,
    codec: "h264", imageFormat: "jpeg", maxRetries: 1,
    framesPerLambda: Math.max(60, Math.ceil(props.songDuration * 30 / 100)),
    concurrencyPerLambda: 1, outName: 'dark-lyrics-' + Date.now() + '.mp4',
    timeoutInMilliseconds: 120000,
  });
  if (!result.renderId || !result.bucketName) throw new Error("Remotion returned incomplete render details");
  return { id: result.renderId, metadata: {
    provider: "remotion", bucketName: result.bucketName,
    functionName: config.functionName, region: config.region,
  }};
}
