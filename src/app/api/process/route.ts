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

    const transcription = await transcribeAudio(fileUrl);

    const analysis = await analyzeWithClaude({
      title,
      artist,
      lyrics: transcription.text,
    });

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

    const clips = await pickClips(analysis.mood, analysis.energy);

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
  let { data: clips } = await supabase
    .from("clips")
    .select("*")
    .eq("mood", mood)
    .eq("energy", energy)
    .limit(10);

  if (!clips || clips.length === 0) {
    const { data } = await supabase
      .from("clips")
      .select("*")
      .eq("mood", mood)
      .limit(10);
    clips = data;
  }

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
// Calculate clip segments based on song duration
  const songDuration = captions.length > 0
    ? captions[captions.length - 1].end + 1
    : 30;

  const cutInterval = (analysis.cutInterval as number) ?? 4;
  const availableClips = clips.length > 0 ? clips : [{ url: "" }];

  // Build video segments
  const segments: { url: string; start: number; duration: number }[] = [];
  let currentTime = 0;
  let clipIndex = 0;

  while (currentTime < songDuration) {
    const segmentDuration = Math.min(cutInterval, songDuration - currentTime);
    segments.push({
      url: availableClips[clipIndex % availableClips.length].url,
      start: currentTime,
      duration: segmentDuration,
    });
    currentTime += segmentDuration;
    clipIndex++;
  }

  // Build video elements from segments
  const videoElements = segments.map((seg, index) => ({
    name: `clip-${index}`,
    type: "video",
    track: 1,
    time: seg.start,
    duration: seg.duration,
    source: seg.url,
    fit: "cover",
  }));
  const captionElements = captions.map((word, index) => ({
    name: `word-${index}`,
    type: "text",
    track: 2,
    time: word.start,
    duration: word.end - word.start + 0.1,
    x: "50%",
    y: "50%",
    width: "90%",
    height: "auto",
    x_anchor: "50%",
    y_anchor: "50%",
    text: word.word.toUpperCase(),
    font_family: "Montserrat",
    font_weight: "700",
    font_size: 130,
    fill_color: "#ffffff",
    text_align: "center",
  }));

  const res = await fetch("https://api.creatomate.com/v1/renders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: {
        output_format: "mp4",
        width: 1080,
        height: 1920,
        elements: [
          {
            name: "background-video",
            type: "video",
            track: 1,
            time: 0,
            source: clipUrl,
            fit: "cover",
          },
          {
            name: "audio",
            type: "audio",
            track: 3,
            time: 0,
            source: fileUrl,
          },
          ...captionElements,
        ],
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
