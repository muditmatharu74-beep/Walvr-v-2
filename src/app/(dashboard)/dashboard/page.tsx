"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);

  const loadVideos = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("videos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    setVideos(data ?? []);
    return data ?? [];
  }, []);

  const checkRenders = useCallback(async (videoList: any[]) => {
    const rendering = videoList.filter((v) => v.status === "rendering" && v.render_id);
    for (const video of rendering) {
      try {
        const res = await fetch("/api/check-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ renderId: video.render_id, videoId: video.id }),
        });
        const data = await res.json();
        if (data.status === "done" || data.status === "error") {
          setVideos((prev) =>
            prev.map((v) =>
              v.id === video.id
                ? { ...v, status: data.status, render_url: data.url }
                : v
            )
          );
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const result = await supabase.auth.getUser();
      const currentUser = result.data.user;
      if (!currentUser) { router.push("/login"); return; }
      setUser(currentUser);
      const profileResult = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
      setProfile(profileResult.data);
      const videoList = await loadVideos(currentUser.id);
      checkRenders(videoList);
    }
    load();
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const videoList = await loadVideos(user.id);
      checkRenders(videoList);
    }, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const plan = profile?.plan ?? "free";
  const planColor = plan === "free" ? "#888" : "#c8102e";

  const stats = [
    { label: "Total Videos", value: String(videos.length) },
    { label: "Completed", value: String(videos.filter((v) => v.status === "done").length) },
    { label: "Credits", value: String(profile?.credits ?? 0) },
    { label: "Plan", value: plan.charAt(0).toUpperCase() + plan.slice(1) },
  ];

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #110508 0%, #0d0305 40%, #130609 100%)",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#f5f0eb",
      position: "relative",
      overflow: "hidden",
    }}>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes wave0 { from { height: 8px; } to { height: 40px; } }
        @keyframes wave1 { from { height: 12px; } to { height: 80px; } }
        @keyframes wave2 { from { height: 6px; } to { height: 55px; } }
        @keyframes wave3 { from { height: 10px; } to { height: 100px; } }
        @keyframes wave4 { from { height: 8px; } to { height: 65px; } }
        @keyframes wave5 { from { height: 15px; } to { height: 45px; } }
        @keyframes wave6 { from { height: 5px; } to { height: 90px; } }
        @keyframes wave7 { from { height: 10px; } to { height: 70px; } }
        @keyframes cardHover { from { background: rgba(200,16,46,0.04); } to { background: rgba(200,16,46,0.09); } }
      `}</style>

      {/* Subtle radial glow — makes wine red pop */}
      <div style={{
        position: "fixed",
        top: "30%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "80vw",
        height: "60vh",
        background: "radial-gradient(ellipse at center, rgba(139,0,20,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />

      {/* Waveform background */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "180px",
        pointerEvents: "none",
        zIndex: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: "3px",
        padding: "0 2rem",
        opacity: 0.1,
      }}>
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} style={{
            flex: 1,
            background: "#c8102e",
            borderRadius: "2px 2px 0 0",
            animation: `wave${i % 8} ${1.5 + (i % 5) * 0.3}s ease-in-out infinite alternate`,
            animationDelay: `${(i % 7) * 0.15}s`,
          }} />
        ))}
      </div>

      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid rgba(200,16,46,0.12)",
        padding: "1.25rem 3rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(13,3,5,0.75)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <span style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase" }}>W∆LVR</span>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "0.75rem", color: "rgba(245,240,235,0.35)", marginBottom: "2px" }}>{user?.email}</p>
            <p style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: planColor }}>{plan} plan</p>
          </div>
          <Link href="/upload" style={{ padding: "0.6rem 1.5rem", background: "#8b0014", color: "#f5f0eb", textDecoration: "none", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", border: "1px solid rgba(200,16,46,0.6)" }}>+ New Video</Link>
          <Link href="/settings" style={{ padding: "0.6rem 1.5rem", background: "transparent", color: "rgba(245,240,235,0.45)", textDecoration: "none", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.08)" }}>Settings</Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ padding: "4rem 3rem", maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 10 }}>

        <div style={{ marginBottom: "3rem" }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>Your Studio</p>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1" }}>Your Videos</h1>
        </div>

        {/* Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1px",
          marginBottom: "4rem",
          background: "rgba(200,16,46,0.08)",
          border: "1px solid rgba(200,16,46,0.1)",
          backdropFilter: "blur(8px)",
        }}>
          {stats.map((stat, i) => (
            <div key={i} style={{ padding: "1.5rem 2rem", background: "rgba(13,3,5,0.5)" }}>
              <p style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,235,0.3)", marginBottom: "0.5rem" }}>{stat.label}</p>
              <p style={{ fontSize: "1.75rem", fontWeight: "700", color: i === 3 ? "#c8102e" : "#f5f0eb", letterSpacing: "-0.02em" }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Videos */}
        {videos.length === 0 ? (
          <div style={{
            border: "1px solid rgba(200,16,46,0.12)",
            padding: "6rem 2rem",
            textAlign: "center",
            background: "rgba(13,3,5,0.4)",
            backdropFilter: "blur(8px)",
          }}>
            <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>No Videos Yet</p>
            <p style={{ color: "rgba(245,240,235,0.35)", marginBottom: "2.5rem", fontSize: "1rem" }}>Upload your first song and get a 4K lyric video in minutes.</p>
            <Link href="/upload" style={{ padding: "1rem 2.5rem", background: "#8b0014", color: "#f5f0eb", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.15em", textTransform: "uppercase", border: "1px solid rgba(200,16,46,0.6)", display: "inline-block" }}>Upload Your First Song</Link>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1px",
            background: "rgba(200,16,46,0.07)",
            border: "1px solid rgba(200,16,46,0.08)",
          }}>
            {videos.map((video) => {
              const isDone = video.status === "done";
              const isRendering = video.status === "rendering" || video.status === "processing";
              const isError = video.status === "error";
              return (
                <div key={video.id}
                  style={{
                    padding: "2rem",
                    background: "rgba(13,3,5,0.45)",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                    transition: "background 0.25s",
                    position: "relative",
                    borderBottom: "1px solid rgba(200,16,46,0.06)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(139,0,20,0.12)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(13,3,5,0.45)"; }}
                >
                  {/* Status */}
                  <div style={{ position: "absolute", top: "1.5rem", right: "1.5rem", display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: isDone ? "#4ade80" : isRendering ? "#c8102e" : "#444",
                      boxShadow: isRendering ? "0 0 8px rgba(200,16,46,0.7)" : isDone ? "0 0 6px rgba(74,222,128,0.4)" : "none",
                    }} />
                    <span style={{ fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: isDone ? "#4ade80" : isRendering ? "#c8102e" : "rgba(245,240,235,0.25)" }}>
                      {isDone ? "Done" : isRendering ? "Rendering" : isError ? "Error" : "Pending"}
                    </span>
                  </div>

                  <p style={{ fontSize: "1.1rem", fontWeight: "600", color: "#f5f0eb", marginBottom: "0.25rem", paddingRight: "5rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.title ?? "Untitled"}</p>
                  <p style={{ fontSize: "0.8rem", color: "rgba(245,240,235,0.35)", marginBottom: "1.5rem", letterSpacing: "0.05em" }}>{video.artist ?? "Unknown Artist"}</p>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "1.5rem" }}>
                    {video.mood && (
                      <span style={{ fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(200,16,46,0.65)", border: "1px solid rgba(200,16,46,0.18)", padding: "0.2rem 0.6rem" }}>{video.mood}</span>
                    )}
                    {video.cap_style && (
                      <span style={{ fontSize: "0.6rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(245,240,235,0.25)", border: "1px solid rgba(255,255,255,0.05)", padding: "0.2rem 0.6rem" }}>{video.cap_style}</span>
                    )}
                  </div>

                  {isDone && video.render_url && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <a href={video.render_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-block", padding: "0.6rem 1.5rem", background: "transparent", color: "#c8102e", textDecoration: "none", fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", border: "1px solid rgba(200,16,46,0.35)", transition: "all 0.2s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#8b0014"; (e.currentTarget as HTMLElement).style.color = "white"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#c8102e"; }}
                      >Download ↓</a>
                      <button
                        onClick={async () => {
                       if (!confirm("Are you sure you want to delete this video?")) return;
                       const supabase = createClient();
                       await supabase.from("videos").delete().eq("id", video.id);
                       setVideos((prev) => prev.filter((v) => v.id !== video.id));
                  }}
                        style={{ padding: "0.6rem 1rem", background: "transparent", color: "rgba(245,240,235,0.25)", border: "1px solid rgba(255,255,255,0.06)", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif", transition: "all 0.2s" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#c8102e"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(200,16,46,0.3)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(245,240,235,0.25)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"; }}
                      >Delete</button>
                    </div>
                  )}

                  {isRendering && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: "2px solid rgba(200,16,46,0.15)", borderTop: "2px solid #c8102e", animation: "spin 1s linear infinite" }} />
                      <span style={{ fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(245,240,235,0.25)" }}>Processing...</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
