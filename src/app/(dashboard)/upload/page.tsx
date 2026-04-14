"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CAPTION_STYLES = [
  {
    id: "bold-overlay",
    label: "Bold Overlay",
    desc: "Big bold words centered on screen",
  },
  {
    id: "word-highlight",
    label: "Word Highlight",
    desc: "Each word lights up as it's sung",
  },
  {
    id: "frosted",
    label: "Frosted Glass",
    desc: "Transparent frosted bar behind lyrics",
  },
  {
    id: "minimal",
    label: "Minimal",
    desc: "Clean small text at the bottom",
  },
  {
    id: "karaoke",
    label: "Karaoke",
    desc: "Color sweeps across each word",
  },
];

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [captionStyle, setCaptionStyle] = useState("bold-overlay");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"upload" | "style">("upload");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title) return;
    setStep("style");
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not logged in");

      // Upload file to Supabase Storage
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      // Create video record
      const { data: video, error: dbError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          title,
          artist,
          cap_style: captionStyle,
          status: "pending",
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Kick off processing
      await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          fileUrl: urlData.publicUrl,
          title,
          artist,
          captionStyle,
        }),
      });

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold gradient-text">New Video</h1>
          <p className="text-muted-foreground">
            Upload your song and we handle everything else.
          </p>
        </div>

        {step === "upload" && (
          <form onSubmit={handleNext} className="glass rounded-2xl p-8 space-y-5">
            {/* File */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Song File</label>
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  accept=".mp3,.mp4,.wav,.m4a"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                  required
                />
                <label htmlFor="file-input" className="cursor-pointer space-y-2 block">
                  {file ? (
                    <p className="text-primary font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="text-muted-foreground">
                        Drop your MP3 or MP4 here
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Title */}
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

            {/* Artist */}
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
              Next — Pick Caption Style
            </button>
          </form>
        )}

        {step === "style" && (
          <div className="glass rounded-2xl p-8 space-y-5">
            <h2 className="text-lg font-semibold">Choose Caption Style</h2>

            <div className="space-y-3">
              {CAPTION_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setCaptionStyle(style.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    captionStyle === style.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium">{style.label}</p>
                  <p className="text-sm text-muted-foreground">{style.desc}</p>
                </button>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("upload")}
                className="flex-1 py-3 glass rounded-lg font-semibold hover:bg-white/10 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? "Uploading..." : "Create Video"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
