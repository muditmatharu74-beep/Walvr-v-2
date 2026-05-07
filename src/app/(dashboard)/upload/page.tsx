"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const VIBES = [
  {
    id: "dark-cinematic",
    label: "Dark & Cinematic",
    desc: "Moody, dark clips with cinematic feel",
    color: "from-gray-900 to-black",
    previewUrl: "",
  },
  {
    id: "blue-aesthetic",
    label: "Blue Aesthetic",
    desc: "Neon blue, cyberpunk vibes",
    color: "from-blue-900 to-black",
    previewUrl: "",
  },
  {
    id: "energetic",
    label: "Energetic",
    desc: "Fast cuts, high energy clips",
    color: "from-orange-900 to-black",
    previewUrl: "",
  },
  {
    id: "emotional",
    label: "Emotional",
    desc: "Slow, cinematic, nature shots",
    color: "from-purple-900 to-black",
    previewUrl: "",
  },
  {
    id: "color-block",
    label: "Color Block",
    desc: "Bold solid color backgrounds",
    color: "from-pink-900 to-black",
    previewUrl: "",
  },
];

const CAPTION_STYLES = [
  {
    id: "bold-overlay",
    label: "Bold",
    desc: "Big white centered text",
    preview: { text: "WORDS", color: "#ffffff", size: "text-4xl", weight: "font-black", bg: "bg-black" },
  },
  {
    id: "word-highlight",
    label: "Highlight",
    desc: "Text with subtle glow background",
    preview: { text: "WORDS", color: "#ffffff", size: "text-3xl", weight: "font-bold", bg: "bg-black" },
  },
  {
    id: "frosted",
    label: "Frosted",
    desc: "White text with glow effect",
    preview: { text: "WORDS", color: "#ffffff", size: "text-3xl", weight: "font-bold", bg: "bg-black" },
  },
  {
    id: "minimal",
    label: "Minimal",
    desc: "Small clean text at bottom",
    preview: { text: "words", color: "rgba(255,255,255,0.85)", size: "text-xl", weight: "font-normal", bg: "bg-black" },
  },
  {
    id: "karaoke",
    label: "Karaoke",
    desc: "Yellow text with white stroke",
    preview: { text: "WORDS", color: "#ffdd00", size: "text-4xl", weight: "font-black", bg: "bg-black" },
  },
];

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "vibe" | "caption">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [selectedVibe, setSelectedVibe] = useState("");
  const [selectedCaption, setSelectedCaption] = useState("bold-overlay");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hoveredVibe, setHoveredVibe] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function handleUploadNext(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title) return;
    setStep("vibe");
  }

  function handleVibeNext() {
    if (!selectedVibe) return;
    setStep("caption");
  }

  async function handleSubmit() {
    if (!file || !selectedVibe || !selectedCaption) return;
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      const { data: video, error: dbError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          title,
          artist,
          cap_style: selectedCaption,
          clip_style: selectedVibe,
          status: "pending",
        })
        .select()
        .single();
      if (dbError) throw dbError;

      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          fileUrl: urlData.publicUrl,
          title,
          artist,
          captionStyle: selectedCaption,
          vibe: selectedVibe,
          userId: user.id,
        }),
      });

      if (res.status === 403) {
        throw new Error("You've reached your monthly video limit. Upgrade your plan to continue.");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">New Video</h1>
          <p className="text-muted-foreground">
            {step === "upload" && "Upload your song to get started."}
            {step === "vibe" && "Pick the vibe for your video."}
            {step === "caption" && "Choose your caption style."}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 justify-center">
          {["upload", "vibe", "caption"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step === s ? "bg-primary text-white" :
                (step === "vibe" && i === 0) || (step === "caption" && i <= 1) ? "bg-primary/40 text-white" :
                "bg-muted text-muted-foreground"
              }`}>
                {i + 1}
              </div>
              {i < 2 && <div className={`w-12 h-0.5 ${
                (step === "vibe" && i === 0) || (step === "caption" && i <= 1) ? "bg-primary/40" : "bg-muted"
              }`} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Upload */}
        {step === "upload" && (
          <form onSubmit={handleUploadNext} className="glass rounded-2xl p-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Song File</label>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".mp3,.mp4,.wav,.m4a"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer block space-y-2">
                  {file ? (
                    <p className="text-primary font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground">Drop your MP3 or MP4 here</p>
                      <p className="text-xs text-muted-foreground">or click to browse</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Song Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Lose Yourself"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Artist Name</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Eminem"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Next — Pick Your Vibe
            </button>
          </form>
        )}

        {/* Step 2 — Vibe Picker */}
        {step === "vibe" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VIBES.map((vibe) => (
                <button
                  key={vibe.id}
                  onClick={() => setSelectedVibe(vibe.id)}
                  onMouseEnter={() => setHoveredVibe(vibe.id)}
                  onMouseLeave={() => setHoveredVibe(null)}
                  className={`relative overflow-hidden rounded-2xl border-2 transition-all text-left ${
                    selectedVibe === vibe.id
                      ? "border-primary scale-[1.02]"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {/* Video preview or gradient placeholder */}
                  <div className={`w-full h-40 bg-gradient-to-br ${vibe.color} relative`}>
                    {vibe.previewUrl ? (
                      <video
                        src={vibe.previewUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-white/20 text-6xl font-black">{vibe.label[0]}</span>
                      </div>
                    )}
                    {selectedVibe === vibe.id && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <span className="text-white text-sm">✓</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-white">{vibe.label}</p>
                    <p className="text-sm text-muted-foreground">{vibe.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("upload")}
                className="flex-1 py-3 glass rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleVibeNext}
                disabled={!selectedVibe}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Next — Pick Caption Style
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Caption Style */}
        {step === "caption" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CAPTION_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedCaption(style.id)}
                  className={`rounded-2xl border-2 overflow-hidden transition-all text-left ${
                    selectedCaption === style.id
                      ? "border-primary scale-[1.02]"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {/* Caption preview */}
                  <div className="w-full h-32 bg-black flex items-center justify-center relative">
                    {style.id === "word-highlight" && (
                      <span className={`${style.preview.size} ${style.preview.weight} px-4 py-2 rounded-lg bg-white/15`}
                        style={{ color: style.preview.color }}>
                        {style.preview.text}
                      </span>
                    )}
                    {style.id === "frosted" && (
                      <span className={`${style.preview.size} ${style.preview.weight}`}
                        style={{ color: style.preview.color, textShadow: "0 0 20px white, 0 0 40px white" }}>
                        {style.preview.text}
                      </span>
                    )}
                    {style.id === "minimal" && (
                      <div className="absolute bottom-4 w-full text-center">
                        <span className={`${style.preview.size} ${style.preview.weight}`}
                          style={{ color: style.preview.color }}>
                          {style.preview.text}
                        </span>
                      </div>
                    )}
                    {style.id === "karaoke" && (
                      <span className={`${style.preview.size} ${style.preview.weight}`}
                        style={{ color: style.preview.color, WebkitTextStroke: "1px white" }}>
                        {style.preview.text}
                      </span>
                    )}
                    {style.id === "bold-overlay" && (
                      <span className={`${style.preview.size} ${style.preview.weight}`}
                        style={{ color: style.preview.color }}>
                        {style.preview.text}
                      </span>
                    )}
                    {selectedCaption === style.id && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold text-white">{style.label}</p>
                    <p className="text-sm text-muted-foreground">{style.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("vibe")}
                className="flex-1 py-3 glass rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Video"}
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
