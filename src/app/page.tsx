"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [navSolid, setNavSolid] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setScrollY(window.scrollY);
      setNavSolid(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const cdRotation = scrollY * 0.3;

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main style={{
      background: "#0a0406",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      overflowX: "hidden",
      minHeight: "100vh",
    }}>

      <style>{`
        @keyframes wave0 { from { height: 8px; } to { height: 40px; } }
        @keyframes wave1 { from { height: 12px; } to { height: 80px; } }
        @keyframes wave2 { from { height: 6px; } to { height: 55px; } }
        @keyframes wave3 { from { height: 10px; } to { height: 100px; } }
        @keyframes wave4 { from { height: 8px; } to { height: 65px; } }
        @keyframes wave5 { from { height: 15px; } to { height: 45px; } }
        @keyframes wave6 { from { height: 5px; } to { height: 90px; } }
        @keyframes wave7 { from { height: 10px; } to { height: 70px; } }
      `}</style>

      {/* Grain overlay */}
      <div style={{
        position: "fixed", inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.4, pointerEvents: "none", zIndex: 1,
      }} />

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "1.25rem 3rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: navSolid ? "rgba(10,4,6,0.95)" : "rgba(10,4,6,0.6)",
        backdropFilter: "blur(12px)",
        borderBottom: navSolid ? "1px solid rgba(200,16,46,0.15)" : "1px solid transparent",
        transition: "all 0.3s",
      }}>
        <span style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase" }}>W∆LVR</span>

        {/* Nav tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          {[
            { label: "How It Works", id: "how-it-works" },
            { label: "Features", id: "features" },
            { label: "Pricing", id: "pricing" },
          ].map((tab) => (
            <button key={tab.id} onClick={() => scrollTo(tab.id)} style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "rgba(245,240,235,0.5)", fontSize: "0.8rem",
              letterSpacing: "0.1em", textTransform: "uppercase",
              fontFamily: "'Georgia', serif",
              transition: "color 0.2s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f5f0eb")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(245,240,235,0.5)")}
            >{tab.label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <Link href="/login" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>Sign In</Link>
          <Link href="/get-started" style={{ padding: "0.6rem 1.5rem", background: "#8b0014", color: "white", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid #c8102e" }}>Get Started</Link>
        </div>
      </nav>

      {/* Fixed CD */}
      <div style={{
        position: "fixed", right: "-8vw", top: "50%",
        width: "55vw", aspectRatio: "1", zIndex: 5,
        transform: "translateY(-50%)", pointerEvents: "none",
      }}>
        <div style={{
          width: "100%", height: "100%", borderRadius: "50%", position: "relative",
          transform: `rotate(${cdRotation}deg)`, willChange: "transform",
        }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: `conic-gradient(from 0deg, #1c0810 0deg, #2e1018 30deg, #150608 70deg, #3a1020 110deg, #150608 150deg, #2a0e16 190deg, #150608 230deg, #3a1020 270deg, #150608 310deg, #1c0810 360deg)`,
            boxShadow: "inset 0 0 80px rgba(0,0,0,0.7), 0 0 120px rgba(139,0,20,0.2)",
          }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 210deg, rgba(255,255,255,0.06) 0deg, transparent 50deg, transparent 290deg, rgba(255,255,255,0.03) 360deg)" }} />
          {[92, 82, 72, 62, 52, 42, 32].map((size, i) => (
            <div key={i} style={{ position: "absolute", borderRadius: "50%", border: `0.5px solid rgba(${i % 2 === 0 ? "200,16,46" : "255,255,255"}, ${0.04 + i * 0.015})`, inset: `${(100 - size) / 2}%` }} />
          ))}
          <div style={{ position: "absolute", width: "28%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #a01020, #3d0008)", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, boxShadow: "0 4px 20px rgba(0,0,0,0.6)" }}>
            <span style={{ fontSize: "clamp(8px, 1.8vw, 16px)", fontWeight: "700", color: "rgba(255,255,255,0.9)", textTransform: "uppercase" }}>W</span>
          </div>
          <div style={{ position: "absolute", width: "6%", aspectRatio: "1", borderRadius: "50%", background: "#0a0406", top: "50%", left: "50%", transform: "translate(-50%, -50%)", border: "1px solid rgba(200,16,46,0.4)", zIndex: 3 }} />
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid rgba(200,16,46,0.15)" }} />
        </div>
        <div style={{ position: "absolute", inset: "-10%", borderRadius: "50%", background: "radial-gradient(circle at center, rgba(139,0,20,0.18) 0%, transparent 65%)", zIndex: -1 }} />
      </div>

      {/* Hero */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", padding: "8rem 3rem 4rem", position: "relative", zIndex: 10 }}>
        <div style={{
          maxWidth: "520px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1.5rem" }}>The Content Engine for Musicians</p>
          <h1 style={{ fontSize: "clamp(2.8rem, 5vw, 5.5rem)", fontWeight: "700", lineHeight: "1.05", color: "#f5f0eb", marginBottom: "2rem", letterSpacing: "-0.02em" }}>
            Your music.<br />Your video.<br /><span style={{ color: "#c8102e" }}>Automatically.</span>
          </h1>
          <p style={{ fontSize: "1.05rem", lineHeight: "1.75", color: "rgba(245, 240, 235, 0.5)", marginBottom: "3rem", maxWidth: "400px" }}>
            Upload a song. Get back a 4K lyric video ready to post on Reels, TikTok, and YouTube. AI handles everything.
          </p>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/get-started" style={{ padding: "1rem 2.5rem", background: "#8b0014", color: "#f5f0eb", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.18em", textTransform: "uppercase", border: "1px solid #c8102e", display: "inline-block" }}>Get Started</Link>
            <button onClick={() => scrollTo("how-it-works")} style={{ padding: "1rem 2.5rem", background: "transparent", color: "rgba(245,240,235,0.55)", fontSize: "0.8rem", letterSpacing: "0.18em", textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer", fontFamily: "'Georgia', serif" }}>See How It Works</button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={{ padding: "8rem 3rem", position: "relative", zIndex: 10, borderTop: "1px solid rgba(139, 0, 20, 0.15)" }}>
        <p style={{ fontSize: "0.7rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem", textAlign: "center" }}>How It Works</p>
        <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: "700", color: "#f5f0eb", textAlign: "center", marginBottom: "5rem", letterSpacing: "-0.02em" }}>Three steps to viral.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", maxWidth: "900px", margin: "0 auto", border: "1px solid rgba(139, 0, 20, 0.15)" }}>
          {[
            { num: "01", title: "Upload Your Song", desc: "Drop an MP3 or MP4. We accept any format." },
            { num: "02", title: "AI Does Everything", desc: "Beat detection, mood analysis, clip selection, lyric sync. All automatic." },
            { num: "03", title: "Download & Post", desc: "Get a 4K video ready for Reels, TikTok, and YouTube Shorts." },
          ].map((f, i) => (
            <div key={i} style={{ padding: "3rem 2rem", borderRight: i < 2 ? "1px solid rgba(139, 0, 20, 0.15)" : "none", transition: "background 0.3s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,0,20,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <p style={{ fontSize: "3rem", fontWeight: "700", color: "rgba(139,0,20,0.2)", marginBottom: "1.5rem", letterSpacing: "-0.03em" }}>{f.num}</p>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#f5f0eb", marginBottom: "0.75rem" }}>{f.title}</h3>
              <p style={{ color: "rgba(245,240,235,0.4)", lineHeight: "1.65", fontSize: "0.875rem" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "8rem 3rem", borderTop: "1px solid rgba(139, 0, 20, 0.15)", position: "relative", zIndex: 10 }}>
        <p style={{ fontSize: "0.7rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem", textAlign: "center" }}>Features</p>
        <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: "700", color: "#f5f0eb", textAlign: "center", marginBottom: "5rem", letterSpacing: "-0.02em" }}>Everything you need.</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1px", maxWidth: "1000px", margin: "0 auto", background: "rgba(139,0,20,0.08)", border: "1px solid rgba(139,0,20,0.08)" }}>
          {[
            { title: "AI Beat Detection", desc: "Every cut lands on a beat. Every time. Automatic." },
            { title: "Word-by-Word Captions", desc: "Real lyrics synced to the millisecond. 5 caption styles." },
            { title: "6 Templates", desc: "Proven viral formats. More added every month for Business users." },
            { title: "4K Export", desc: "Download at full resolution ready to post anywhere." },
            { title: "Mood Matching", desc: "AI picks clips that match your song's energy and vibe." },
            { title: "No Editing Required", desc: "Upload. Pick a template. Download. Done." },
          ].map((f, i) => (
            <div key={i} style={{ padding: "2.5rem 2rem", background: "rgba(13,3,5,0.5)", transition: "background 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,0,20,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(13,3,5,0.5)")}
            >
              <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#f5f0eb", marginBottom: "0.6rem" }}>{f.title}</h3>
              <p style={{ color: "rgba(245,240,235,0.4)", fontSize: "0.85rem", lineHeight: "1.6" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: "8rem 3rem", borderTop: "1px solid rgba(139, 0, 20, 0.15)", position: "relative", zIndex: 10 }}>
        <p style={{ fontSize: "0.7rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem", textAlign: "center" }}>Pricing</p>
        <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: "700", color: "#f5f0eb", textAlign: "center", marginBottom: "1rem", letterSpacing: "-0.02em" }}>Simple. No surprises.</h2>
        <p style={{ color: "rgba(245,240,235,0.35)", textAlign: "center", marginBottom: "5rem", fontSize: "0.95rem" }}>
          Not sure which plan? <Link href="/get-started" style={{ color: "#c8102e", textDecoration: "none" }}>Take the quiz →</Link>
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1px", maxWidth: "900px", margin: "0 auto", background: "rgba(139,0,20,0.08)" }}>
          {[
            {
              name: "Starter", price: "$9", period: "/month",
              features: ["10 videos/month", "No watermark", "1080p export", "3 templates"],
              featured: false,
            },
            {
              name: "Pro", price: "$19", period: "/month",
              features: ["Unlimited videos", "No watermark", "1080p export", "All templates", "Priority support"],
              featured: true,
            },
            {
              name: "Business", price: "$49", period: "/month",
              features: ["Unlimited videos", "No watermark", "4K export", "All templates", "New templates monthly"],
              featured: false,
            },
          ].map((plan, i) => (
            <div key={i} style={{
              padding: "3rem 2rem", background: "#0a0406", position: "relative",
              outline: plan.featured ? "1px solid rgba(200,16,46,0.4)" : "none",
            }}>
              {plan.featured && (
                <p style={{ position: "absolute", top: "-1px", left: "50%", transform: "translateX(-50%)", background: "#8b0014", color: "white", fontSize: "0.6rem", letterSpacing: "0.25em", textTransform: "uppercase", padding: "0.25rem 1rem", whiteSpace: "nowrap" }}>Most Popular</p>
              )}
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>{plan.name}</p>
              <p style={{ marginBottom: "2.5rem" }}>
                <span style={{ fontSize: "3.5rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.03em" }}>{plan.price}</span>
                <span style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.85rem" }}>{plan.period}</span>
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2.5rem" }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ padding: "0.65rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(245,240,235,0.6)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ color: "#c8102e", fontSize: "0.55rem" }}>◆</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/get-started" style={{ display: "block", textAlign: "center", padding: "0.9rem", background: plan.featured ? "#8b0014" : "transparent", color: plan.featured ? "white" : "rgba(245,240,235,0.5)", textDecoration: "none", fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase", border: `1px solid ${plan.featured ? "#c8102e" : "rgba(255,255,255,0.1)"}` }}>
                Get Started →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "2.5rem 3rem", borderTop: "1px solid rgba(139, 0, 20, 0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 10 }}>
        <span style={{ fontSize: "1rem", fontWeight: "700", letterSpacing: "0.15em", color: "#c8102e", textTransform: "uppercase" }}>W∆LVR</span>
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          <Link href="/login" style={{ color: "rgba(245,240,235,0.25)", fontSize: "0.75rem", textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>Sign In</Link>
          <Link href="/get-started" style={{ color: "rgba(245,240,235,0.25)", fontSize: "0.75rem", textDecoration: "none", letterSpacing: "0.1em", textTransform: "uppercase" }}>Get Started</Link>
        </div>
        <p style={{ color: "rgba(245,240,235,0.2)", fontSize: "0.75rem" }}>© 2026 Walvr. All rights reserved.</p>
      </footer>

    </main>
  );
}
