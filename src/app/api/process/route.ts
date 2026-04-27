import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  let videoId = "";

  try {
    const body = await request.json();
    videoId = body.videoId;
    const { fileUrl, title, artist, captionStyle } = body;

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
    });

    // Step 3: Save analysis
    await supabase
      .from("videos")
      .update({
        analysis,
        captions: transcription.words,
        mood: analysis.mood,
        genre: analysis.genre,
        status: "rendering",
      })
      .eq("id", videoId);

    // Step 4: Pick clips from library
    const clips = await pickClips(analysis.mood, analysis.energy);

    // Step 5: Start Creatomate render
    const render = await startRender({
      videoId,
      analysis,
      captions: transcription.words ?? [],
      captionStyle,
      title,
      artist,
      fileUrl,
      clips,
    });

    await supabase
      .from("videos")
      .update({ render_id: render.id, status: "rendering" })
      .eq("id", videoId);

    return NextResponse.json({ success: true, renderId: render.id });
  } catch (err) {
    console.error("Process error:", err);
    if (videoId) {
      await supabase
        .from("videos")
        .update({ status: "error" })
        .eq("id", videoId);
    }
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function transcribeAudio(fileUrl: string) {
  const response = await fetch(fileUrl);
  const buffer = await response.arrayBuffer();
  const blob = new Blob([buffer], { type: "audio/mpeg" });

  const formData = new FormData();
  formData.append("file", blob, "audio.mp3");
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");

  const whisperRes = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: formData,
    }
  );

  if (!whisperRes.ok) throw new Error("Whisper transcription failed");
  return whisperRes.json();
}

async function analyzeWithClaude({
  title,
  artist,
  lyrics,
}: {
  title: string;
  artist: string;
  lyrics: string;
}) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a music video director AI. Analyze this song and return JSON only, no markdown.

Song: "${title}" by ${artist}
Lyrics: ${lyrics}

Return exactly:
{
  "mood": "one of: energetic, dark, sad, romantic, aggressive, chill, uplifting",
  "energy": "one of: high, medium, low",
  "genre": "detected genre",
  "themes": ["theme1"],
  "clipStyle": "one of: fast-cuts, slow-cinematic, mixed",
  "colorGrade": "one of: warm, cold, dark, vibrant, monochrome",
  "cutInterval": 4,
  "notes": "brief director notes"
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
      mood: "dark",
      energy: "medium",
      genre: "unknown",
      themes: [],
      clipStyle: "mixed",
      colorGrade: "dark",
      cutInterval: 4,
      notes: "",
    };
  }
}

async function pickClips(mood: string, energy: string) {
  // Try exact match first
  let { data: clips } = await supabase
    .from("clips")
    .select("*")
    .eq("mood", mood)
    .eq("energy", energy)
    .limit(10);

  // Fallback to mood only
  if (!clips || clips.length === 0) {
    const { data } = await supabase
      .from("clips")
      .select("*")
      .eq("mood", mood)
      .limit(10);
    clips = data;
  }

  // Fallback to any clips
  if (!clips || clips.length === 0) {
    const { data } = await supabase.from("clips").select("*").limit(10);
    clips = data;
  }

  return clips ?? [];
}

async function startRender({
  videoId,
  analysis,
  captions,
  captionStyle,
  title,
  artist,
  fileUrl,
  clips,
}: {
  videoId: string;
  analysis: Record<string, unknown>;
  captions: Array<{ word: string; start: number; end: number }>;
  captionStyle: string;
  title: string;
  artist: string;
  fileUrl: string;
  clips: Array<{ url: string }>;
}) {
  // Pick first available clip
  const clipUrl = clips[0]?.url ?? "";

  // Build lyrics text from captions
  const lyricsText = captions
    .map((w) => w.word)
    .join(" ")
    .toUpperCase();

  const res = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: process.env.CREATOMATE_TEMPLATE_ID,
      modifications: {
        "background-video": clipUrl,
        lyrics: lyricsText,
        audio: fileUrl,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Creatomate error:", err);
    throw new Error("Creatomate render failed");
  }

  const data = await res.json();
  return data[0];
}
