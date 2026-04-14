import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(request: Request) {
  try {
    const { videoId, fileUrl, title, artist, captionStyle } =
      await request.json();

    const supabase = await createClient();

    // Update status to processing
    await supabase
      .from("videos")
      .update({ status: "processing" })
      .eq("id", videoId);

    // Step 1: Transcribe with Whisper
    const transcription = await transcribeAudio(fileUrl);

    // Step 2: Analyze with Claude
    const analysis = await analyzeWithClaude({
      title,
      artist,
      lyrics: transcription.text,
      words: transcription.words,
    });

    // Step 3: Save analysis and captions
    await supabase
      .from("videos")
      .update({
        analysis: analysis,
        captions: transcription.words,
        mood: analysis.mood,
        genre: analysis.genre,
        status: "rendering",
      })
      .eq("id", videoId);

    // Step 4: Kick off Creatomate render
    const render = await startRender({
      videoId,
      analysis,
      captions: transcription.words,
      captionStyle,
      title,
      artist,
    });

    // Save render ID
    await supabase
      .from("videos")
      .update({
        render_id: render.id,
        status: "rendering",
      })
      .eq("id", videoId);

    return NextResponse.json({ success: true, renderId: render.id });
  } catch (err) {
    console.error("Process error:", err);

    const { videoId } = await request.json().catch(() => ({}));
    if (videoId) {
      const supabase = await createClient();
      await supabase
        .from("videos")
        .update({ status: "error" })
        .eq("id", videoId);
    }

    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 }
    );
  }
}

async function transcribeAudio(fileUrl: string) {
  // Download the file
  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();
  const blob = new Blob([buffer], { type: "audio/mpeg" });

  // Call Whisper API
  const formData = new FormData();
  formData.append("file", blob, "audio.mp3");
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  const whisperRes = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!whisperRes.ok) {
    throw new Error("Whisper transcription failed");
  }

  return whisperRes.json();
}

async function analyzeWithClaude({
  title,
  artist,
  lyrics,
  words,
}: {
  title: string;
  artist: string;
  lyrics: string;
  words: Array<{ word: string; start: number; end: number }>;
}) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a music video director AI. Analyze this song and return a JSON object only, no markdown.

Song: "${title}" by ${artist}

Lyrics:
${lyrics}

Return this exact JSON structure:
{
  "mood": "one of: energetic, dark, sad, romantic, aggressive, chill, uplifting",
  "energy": "one of: high, medium, low",
  "genre": "detected genre",
  "themes": ["theme1", "theme2"],
  "clipStyle": "one of: fast-cuts, slow-cinematic, mixed",
  "colorGrade": "one of: warm, cold, dark, vibrant, monochrome",
  "beatMap": [
    { "time": 0, "type": "verse", "energy": 0.5 },
    { "time": 30, "type": "chorus", "energy": 0.9 }
  ],
  "notes": "brief director notes for clip selection"
}`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "{}";

  try {
    return JSON.parse(text);
  } catch {
    return {
      mood: "energetic",
      energy: "medium",
      genre: "unknown",
      themes: [],
      clipStyle: "mixed",
      colorGrade: "vibrant",
      beatMap: [],
      notes: "",
    };
  }
}

async function startRender({
  videoId,
  analysis,
  captions,
  captionStyle,
  title,
  artist,
}: {
  videoId: string;
  analysis: Record<string, unknown>;
  captions: Array<{ word: string; start: number; end: number }>;
  captionStyle: string;
  title: string;
  artist: string;
}) {
  const res = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: process.env.CREATOMATE_TEMPLATE_ID,
      modifications: {
        title,
        artist,
        caption_style: captionStyle,
        mood: analysis.mood,
        energy: analysis.energy,
        captions: JSON.stringify(captions),
      },
    }),
  });

  if (!res.ok) {
    throw new Error("Creatomate render failed");
  }

  const data = await res.json();
  return data[0];
}
