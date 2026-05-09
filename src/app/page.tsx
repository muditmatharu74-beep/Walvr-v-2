"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const cdRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const cdRotation = scrollY * 0.5;
  const cdY = scrollY * 0.3;

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{
      background: "#0a0406",
      fontFamily: "'Georgia', 'Times New Roman', serif",
    }}>

      {/* Grain overlay */}
      <div style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.4,
        pointerEvents: "none",
        zIndex: 1,
      }} />

      {/* Nav */}
      <nav style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: "1.5rem 3rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(139, 0, 20, 0.2)",
        background: "rgba(10, 4, 6, 0.8)",
        backdropFilter: "blur(12px)",
      }}>
        <span style={{
          fontSize: "1.5rem",
          fontWeight: "700",
          letterSpacing: "0.15em",
          color: "#c8102e",
          textTransform: "uppercase",
        }}>WAVLR</span>
        <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
          <Link href="/login" style={{
            color: "rgba(255,255,255,0.6)",
            textDecoration: "none",
            fontSize: "0.875rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}>Sign In</Link>
          <Link href="/signup" style={{
            padding: "0.6rem 1.5rem",
            background: "#8b0014",
            color: "white",
            textDecoration: "none",
            fontSize: "0.875rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            border: "1px solid #c8102e",
          }}>Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        padding: "8rem 3rem 4rem",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Left — Text */}
        <div style={{
          flex: 1,
          maxWidth: "560px",
          position: "relative",
          zIndex: 10,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}>
          <p style={{
            fontSize: "0.75rem",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "#c8102e",
            marginBottom: "1.5rem",
          }}>The Content Engine for Musicians</p>

          <h1 style={{
            fontSize: "clamp(3rem, 6vw, 5.5rem)",
            fontWeight: "700",
            lineHeight: "1.05",
            color: "#f5f0eb",
            marginBottom: "2rem",
            letterSpacing: "-0.02em",
          }}>
            Your music.<br />
            Your video.<br />
            <span style={{ color: "#c8102e" }}>Automatically.</span>
          </h1>

          <p style={{
            fontSize: "1.125rem",
            lineHeight: "1.7",
            color: "rgba(245, 240, 235, 0.6)",
            marginBottom: "3rem",
            maxWidth: "420px",
            fontFamily: "'Georgia', serif",
          }}>
            Upload a song. Get back a 4K lyric video ready to post on Reels, TikTok, and YouTube. 
            AI handles everything — beat detection, clip selection, word-by-word captions.
          </p>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link href="/signup" style={{
              padding: "1rem 2.5rem",
              background: "#8b0014",
              color: "#f5f0eb",
              textDecoration: "none",
              fontSize: "0.9rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              border: "1px solid #c8102e",
              transition: "all 0.2s",
              display: "inline-block",
            }}>Start Free</Link>
            <Link href="/login" style={{
              padding: "1rem 2.5rem",
              background: "transparent",
              color: "rgba(245,240,235,0.7)",
              textDecoration: "none",
              fontSize: "0.9rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              border: "1px solid rgba(255,255,255,0.15)",
              transition: "all 0.2s",
              display: "inline-block",
            }}>Sign In</Link>
          </div>
        </div>

        {/* Right — CD Player */}
        <div style={{
          position: "absolute",
          right: "5%",
          top: "50%",
          transform: `translateY(calc(-50% + ${cdY}px))`,
          width: "min(45vw, 500px)",
          aspectRatio: "1",
          zIndex: 5,
        }}>
          {/* CD Player Body */}
          <div style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #1a0a0e 0%, #0d0406 50%, #1a0a0e 100%)",
            borderRadius: "16px",
            border: "1px solid rgba(200, 16, 46, 0.3)",
            boxShadow: "0 0 80px rgba(139, 0, 20, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}>
            {/* Player texture lines */}
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: "1px",
                top: `${12 + i * 12}%`,
                background: "rgba(255,255,255,0.02)",
              }} />
            ))}

            {/* CD Disc */}
            <div
              ref={cdRef}
              style={{
                width: "72%",
                aspectRatio: "1",
                borderRadius: "50%",
                position: "relative",
                transform: `rotate(${cdRotation}deg)`,
                transition: "transform 0.1s linear",
              }}
            >
              {/* Disc layers */}
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: `conic-gradient(
                  from 0deg,
                  #1a0810 0deg,
                  #2d0f1a 30deg,
                  #1a0810 60deg,
                  #3d1520 90deg,
                  #1a0810 120deg,
                  #2d0f1a 150deg,
                  #1a0810 180deg,
                  #3d1520 210deg,
                  #1a0810 240deg,
                  #2d0f1a 270deg,
                  #1a0810 300deg,
                  #3d1520 330deg,
                  #1a0810 360deg
                )`,
                boxShadow: "0 0 40px rgba(139, 0, 20, 0.4), inset 0 0 30px rgba(0,0,0,0.5)",
              }} />

              {/* Rainbow sheen rings */}
              {[85, 70, 55, 40].map((size, i) => (
                <div key={i} style={{
                  position: "absolute",
                  borderRadius: "50%",
                  border: `1px solid rgba(${i % 2 === 0 ? "200,16,46" : "139,0,20"}, ${0.1 + i * 0.05})`,
                  inset: `${(100 - size) / 2}%`,
                }} />
              ))}

              {/* Center hole */}
              <div style={{
                position: "absolute",
                width: "12%",
                aspectRatio: "1",
                borderRadius: "50%",
                background: "#0a0406",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                border: "1px solid rgba(200, 16, 46, 0.4)",
                zIndex: 2,
              }} />

              {/* Wavlr label on disc */}
              <div style={{
                position: "absolute",
                width: "30%",
                aspectRatio: "1",
                borderRadius: "50%",
                background: "radial-gradient(circle, #8b0014, #3d0008)",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
              }}>
                <span style={{
                  fontSize: "clamp(6px, 1.5vw, 10px)",
                  fontWeight: "700",
                  letterSpacing: "0.1em",
                  color: "rgba(255,255,255,0.8)",
                  textTransform: "uppercase",
                }}>W</span>
              </div>
            </div>

            {/* Play button */}
            <div style={{
              position: "absolute",
              bottom: "8%",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: "12px",
            }}>
              {["⏮", "▶", "⏭"].map((btn, i) => (
                <div key={i} style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: i === 1 ? "#8b0014" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${i === 1 ? "#c8102e" : "rgba(255,255,255,0.1)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  color: "rgba(255,255,255,0.7)",
                  cursor: "pointer",
                }}>{btn}</div>
              ))}
            </div>

            {/* Glow */}
            <div style={{
              position: "absolute",
              inset: "-20%",
              background: "radial-gradient(circle at center, rgba(139,0,20,0.15) 0%, transparent 70%)",
              pointerEvents: "none",
            }} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{
        padding: "6rem 3rem",
        position: "relative",
        zIndex: 10,
        borderTop: "1px solid rgba(139, 0, 20, 0.2)",
      }}>
        <p style={{
          fontSize: "0.75rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "#c8102e",
          marginBottom: "1rem",
          textAlign: "center",
        }}>How It Works</p>
        <h2 style={{
          fontSize: "clamp(2rem, 4vw, 3.5rem)",
          fontWeight: "700",
          color: "#f5f0eb",
          textAlign: "center",
          marginBottom: "4rem",
          letterSpacing: "-0.02em",
        }}>Three steps to viral.</h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "2px",
          maxWidth: "1100px",
          margin: "0 auto",
          border: "1px solid rgba(139, 0, 20, 0.2)",
        }}>
          {[
            { num: "01", title: "Upload Your Song", desc: "Drop an MP3 or MP4. We accept any format. Takes seconds." },
            { num: "02", title: "AI Does Everything", desc: "Beat detection, mood analysis, clip selection, lyric sync. All automatic." },
            { num: "03", title: "Download & Post", desc: "Get a 4K video ready for Reels, TikTok, and YouTube Shorts." },
          ].map((f, i) => (
            <div key={i} style={{
              padding: "3rem 2.5rem",
              borderRight: i < 2 ? "1px solid rgba(139, 0, 20, 0.2)" : "none",
              background: "rgba(139, 0, 20, 0.03)",
              transition: "background 0.3s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(139, 0, 20, 0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(139, 0, 20, 0.03)")}
            >
              <p style={{
                fontSize: "3rem",
                fontWeight: "700",
                color: "rgba(139, 0, 20, 0.3)",
                marginBottom: "1.5rem",
                letterSpacing: "-0.03em",
                fontFamily: "'Georgia', serif",
              }}>{f.num}</p>
              <h3 style={{
                fontSize: "1.25rem",
                fontWeight: "600",
                color: "#f5f0eb",
                marginBottom: "0.75rem",
                letterSpacing: "-0.01em",
              }}>{f.title}</h3>
              <p style={{
                color: "rgba(245, 240, 235, 0.5)",
                lineHeight: "1.6",
                fontSize: "0.95rem",
              }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section style={{
        padding: "6rem 3rem",
        borderTop: "1px solid rgba(139, 0, 20, 0.2)",
        position: "relative",
        zIndex: 10,
      }}>
        <p style={{
          fontSize: "0.75rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "#c8102e",
          marginBottom: "1rem",
          textAlign: "center",
        }}>Pricing</p>
        <h2 style={{
          fontSize: "clamp(2rem, 4vw, 3.5rem)",
          fontWeight: "700",
          color: "#f5f0eb",
          textAlign: "center",
          marginBottom: "4rem",
          letterSpacing: "-0.02em",
        }}>Simple. No surprises.</h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1px",
          maxWidth: "900px",
          margin: "0 auto",
          background: "rgba(139, 0, 20, 0.2)",
        }}>
          {[
            {
              name: "Pro",
              price: "$19",
              period: "/month",
              features: ["20 videos/month", "No watermark", "1080p export", "All caption styles", "All vibes"],
              featured: false,
            },
            {
              name: "Business",
              price: "$49",
              period: "/month",
              features: ["Unlimited videos", "No watermark", "4K export", "All caption styles", "All vibes", "Priority rendering"],
              featured: true,
            },
          ].map((plan, i) => (
            <div key={i} style={{
              padding: "3rem 2.5rem",
              background: plan.featured ? "#0d0406" : "#0a0406",
              position: "relative",
              border: plan.featured ? "1px solid rgba(200, 16, 46, 0.5)" : "none",
            }}>
              {plan.featured && (
                <p style={{
                  position: "absolute",
                  top: "-1px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#8b0014",
                  color: "white",
                  fontSize: "0.65rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  padding: "0.3rem 1rem",
                }}>Most Popular</p>
              )}
              <p style={{
                fontSize: "0.75rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "#c8102e",
                marginBottom: "1rem",
              }}>{plan.name}</p>
              <p style={{ marginBottom: "2rem" }}>
                <span style={{ fontSize: "3.5rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.03em" }}>{plan.price}</span>
                <span style={{ color: "rgba(245,240,235,0.4)", fontSize: "0.9rem" }}>{plan.period}</span>
              </p>
              <ul style={{ listStyle: "none", padding: 0, marginBottom: "2.5rem" }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{
                    padding: "0.6rem 0",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    color: "rgba(245,240,235,0.7)",
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}>
                    <span style={{ color: "#c8102e", fontSize: "0.7rem" }}>◆</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" style={{
                display: "block",
                textAlign: "center",
                padding: "0.875rem",
                background: plan.featured ? "#8b0014" : "transparent",
                color: plan.featured ? "white" : "rgba(245,240,235,0.6)",
                textDecoration: "none",
                fontSize: "0.8rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                border: `1px solid ${plan.featured ? "#c8102e" : "rgba(255,255,255,0.15)"}`,
                transition: "all 0.2s",
              }}>Get Started</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "3rem",
        borderTop: "1px solid rgba(139, 0, 20, 0.2)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "relative",
        zIndex: 10,
      }}>
        <span style={{
          fontSize: "1rem",
          fontWeight: "700",
          letterSpacing: "0.15em",
          color: "#c8102e",
          textTransform: "uppercase",
        }}>WAVLR</span>
        <p style={{
          color: "rgba(245,240,235,0.3)",
          fontSize: "0.8rem",
        }}>© 2026 Wavlr. All rights reserved.</p>
      </footer>

    </main>
  );
}
