import { renderMediaOnLambda } from "@remotion/lambda/client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { captions, beats, songDuration, audioUrl, plan } = await request.json();

    const result = await renderMediaOnLambda({
      region: "us-east-1",
      functionName: process.env.REMOTION_FUNCTION_NAME!,
      serveUrl: process.env.REMOTION_SERVE_URL!,
      composition: "DarkLyrics",
      inputProps: {
        captions,
        beats,
        songDuration,
        audioUrl,
      },
      codec: "h264",
      imageFormat: "jpeg",
      maxRetries: 1,
      framesPerLambda: 20,
      concurrencyPerLambda: 1,
      outName: `dark-lyrics-${Date.now()}.mp4`,
      timeoutInMilliseconds: 120000,
    });

    return NextResponse.json({
      renderId: result.renderId,
      bucketName: result.bucketName,
    });
  } catch (err) {
    console.error("Remotion render error:", err);
    return NextResponse.json({ error: "Render failed" }, { status: 500 });
  }
}
