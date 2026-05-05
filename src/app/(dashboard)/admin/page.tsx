"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ADMIN_USER_ID = "9e87c63d-2535-4a00-be94-6dae6899a4ab";
const MOODS = ["dark", "sad", "energetic", "romantic", "aggressive", "chill", "uplifting"];
const ENERGIES = ["low", "medium", "high"];
const VIBES = ["Dark & Cinematic", "Blue Aesthetic", "Energetic", "Emotional", "Abstract", "Color Block"];

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [clips, setClips] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ mood: "dark", energy: "low", vibe: "Dark & Cinematic" });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function check() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== ADMIN_USER_ID) {
        router.push("/dashboard");
        return;
      }
      setAuthorized(true);
      loadClips();
    }
    check();
  }, []);

  async function loadClips() {
    const supabase = createClient();
    const { data } = await supabase
      .from("clips")
      .select("*")
      .order("created_at", { ascending: false });
    setClips(data ?? []);
  }

async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/upload-clip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          mood: form.mood,
          energy: form.energy,
          vibe: form.vibe,
        }),
      });
      const { uploadUrl, clipUrl } = await res.json();
      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const supabase = createClient();
      await supabase.from("clips").insert({
        name: file.name,
        url: clipUrl,
        mood: form.mood,
        energy: form.energy,
        vibe: form.vibe,
      });
      setMessage("Clip uploaded successfully.");
      setFile(null);
      loadClips();
    } catch (err) {
      setMessage("Upload failed.");
      console.error(err);
    }
    setUploading(false);
  }

      const { clipUrl, error } = await res.json();
      if (error) throw new Error(error);

      const supabase = createClient();
      await supabase.from("clips").insert({
        name: file.name,
        url: clipUrl,
        mood: form.mood,
        energy: form.energy,
        vibe: form.vibe,
      });
      setMessage("Clip uploaded successfully.");
      setFile(null);
      loadClips();
    } catch (err) {
      setMessage("Upload failed.");
      console.error(err);
    }
    setUploading(false);
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from("clips").delete().eq("id", id);
    loadClips();
  }

  if (!authorized) return null;

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-10">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Clip Library Admin</h1>
          <p className="text-muted-foreground mt-1">Upload and manage your B-roll clips.</p>
        </div>

        <div className="glass rounded-2xl p-8 space-y-5">
          <h2 className="text-xl font-semibold">Upload New Clip</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium">Video File</label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground"
            />
            {file && <p className="text-sm text-muted-foreground">{file.name}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Mood</label>
              <select
                value={form.mood}
                onChange={(e) => setForm({ ...form, mood: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground"
              >
                {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Energy</label>
              <select
                value={form.energy}
                onChange={(e) => setForm({ ...form, energy: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground"
              >
                {ENERGIES.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Vibe</label>
              <select
                value={form.vibe}
                onChange={(e) => setForm({ ...form, vibe: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground"
              >
                {VIBES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          {message && <p className="text-sm text-green-400">{message}</p>}
          <button
            onClick={handleUpload}
            disabled={uploading || !file}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload Clip"}
          </button>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Clips ({clips.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {clips.map((clip) => (
              <div key={clip.id} className="glass rounded-xl p-5 space-y-2">
                <p className="font-medium text-white truncate">{clip.name}</p>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-muted rounded-full">{clip.mood}</span>
                  <span className="px-2 py-1 bg-muted rounded-full">{clip.energy}</span>
                  <span className="px-2 py-1 bg-muted rounded-full">{clip.vibe}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <a href={clip.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                    Preview
                  </a>
                  <button onClick={() => handleDelete(clip.id)} className="text-xs text-red-400 hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
