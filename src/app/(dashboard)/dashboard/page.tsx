"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);

      const { data: profile } = await supabase
        .from("profiles").select("*").eq("id", user.id).single();
      setProfile(profile);

      const { data: videos } = await supabase
        .from("videos").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setVideos(videos ?? []);
    }

    load();
  }, []);

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Wavlr</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {user?.email} &middot; {profile?.plan ?? "free"} plan
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/upload" className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity">
              + New Video
            </Link>
            <Link href="/settings" className="px-5 py-2.5 glass rounded-lg font-semibold hover:bg-white/10 transition-colors">
              Settings
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Videos</h2>
          {videos.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center space-y-4">
              <p className="text-muted-foreground text-lg">No videos yet.</p>
              <Link href="/upload" className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition-opacity">
                Upload Your First Song
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {videos.map((video) => (
                <div key={video.id} className="glass rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white truncate">{video.title ?? "Untitled"}</h3>
                      <p className="text-muted-foreground text-sm">{video.artist ?? "Unknown Artist"}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      video.status === "done" ? "bg-green-500/20 text-green-400" :
                      video.status === "processing" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {video.status}
                    </span>
                  </div>
                  {video.status === "done" && video.render_url && (
                    <a href={video.render_url} target="_blank" rel="noopener noreferrer"
                      className="block w-full text-center py-2 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors">
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
