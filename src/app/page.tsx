"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const cdRotation = scrollY * 0.3;

  return (
    <main style={{
      background: "#0a0406",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      overflowX: "hidden",
      minHeight: "100vh",
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
        zIndex: 100,
        padding: "1.5rem 3rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid rgba(139, 0, 20, 0.2)",
        background: "rgba(10, 4, 6, 0.85)",
        backdropFilter: "blur(12px)",
      }}>
        <span style={{
          fontSize: "1.5rem",
          fontWeight: "700",
          letterSpacing: "0.15em",
          color: "#c8102e",
          textTransform: "uppercase",
        }}>W∆LVR</span>
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

      {/* Fixed CD Disc — right side, rotates on scroll */}
      <div style={{
        position: "fixed",
        right: "-8vw",
        top: "50%",
        transform: "translateY(-50%)",
        width: "55vw",
        aspectRatio: "1",
        zIndex: 5,
        pointerEvents: "none",
      }}>
        {/* Outer disc */}
        <div style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          position: "relative",
          transform: `rotate(${cdRotation}deg)`,
          willChange: "transform",
        }}>
          {/* Main disc body */}
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `conic-gradient(
              from 0deg,
              #1c0810 0deg,
              #2e1018 30deg,
              #150608 70deg,
              #3a1020 110deg,
              #150608 150deg,
              #2a0e16 190deg,
              #150608 230deg,
              #3a1020 270deg,
              #150608 310deg,
              #1c0810 360deg
            )`,
            boxShadow: "inset 0 0 80px rgba(0,0,0,0.7), 0 0 120px rgba(139,0,20,0.2)",
          }} />

          {/* Iridescent sheen */}
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "conic-gradient(from 210deg, rgba(255,255,255,0.06) 0deg, transparent 50deg, transparent 290deg, rgba(255,255,255,0.03) 360deg)",
          }} />

          {/* Track rings */}
          {[92, 82, 72, 62, 52, 42, 32].map((size, i) => (
            <div key={i} style={{
              position: "absolute",
              borderRadius: "50%",
              border: `0.5px solid rgba(${i % 2 === 0 ? "200,16,46" : "255,200,200"}, ${0.04 + i * 0.015})`,
              inset: `${(100 - size) / 2}%`,
            }} />
          ))}

          {/* Center label */}
          <div style={{
            position: "absolute",
            width: "22%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #a01020, #3d0008)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
          }}>
            <span style={{
              fontSize: "clamp(8px, 1.8vw, 16px)",
              fontWeight: "700",
              letterSpacing: "0.05em",
              color: "rgba(255,255,255,0.9)",
              textTransform: "uppercase",
            }}>W</span>
          </div>

          {/* Center hole */}
          <div style={{
            position: "absolute",
            width: "6%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: "#0a0406",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            border: "1px solid rgba(200,16,46,0.4)",
            zIndex: 3,
          }} />

          {/* Edge glow */}
          <div style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "1px solid rgba(200,16,46,0.15)",
          }} />
        </div>

        {/* Red ambient glow behind disc */}
        <div style={{
          position: "absolute",
          inset: "-10%",
          borderRadius: "50%",
          background: "radial-gradient(circle at center, rgba(139,0,20,0.18) 0%, transparent 65%)",
          zIndex: -1,
        }} />
      </div>

      {/* Hero Section */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        padding: "8rem 3rem 4rem",
        position: "relative",
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: "520px",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.8s ease, transform 0.8s ease",
        }}>
          <p style={{
            fontSize: "0.7rem",
            letterSpacing: "0.35em",
            textTransform: "uppercase",
            color: "#c8102e",
            marginBottom: "1.5rem",
          }}>The Content Engine for Musicians</p>

          <h1 style={{
            fontSize: "clamp(2.8rem, 5vw, 5.5rem)",
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
            fontSize: "1.05rem",
            lineHeight: "1.75",
            color: "rgba(245, 240, 235, 0.5)",
            marginBottom: "3rem",
            maxWidth: "400px",
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
              fontSize: "0.8rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              border: "1px solid #c8102e",
              display: "inline-block",
            }}>Start Free</Link>
            <Link href="/login" style={{
              padding: "1rem 2.5rem",
              background: "transparent",
              color: "rgba(245,240,235,0.55)",
              textDecoration: "none",
              fontSize: "0.8rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "inline-block",
            }}>Sign In</Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section style={{
        padding: "8rem 3rem",
        position: "relative",
        zIndex: 10,
        borderTop: "1px solid rgba(139, 0, 20, 0.15)",
      }}>
        <p style={{
          fontSize: "0.7rem",
          letterSpacing: "0.35em",
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
          marginBottom: "5rem",
          letterSpacing: "-0.02em",
        }}>Three steps to viral.</h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          maxWidth: "900px",
          margin: "0 auto",
          border: "1px solid rgba(139, 0, 20, 0.15)",
        }}>
          {[
            { num: "01", title: "Upload Your Song", desc: "Drop an MP3 or MP4. We accept any format." },
            { num: "02", title: "AI Does Everything", desc: "Beat detection, mood analysis, clip selection, lyric sync. All automatic." },
            { num: "03", title: "Download & Post", desc: "Get a 4K video ready for Reels, TikTok, and YouTube Shorts." },
          ].map((f, i) => (
            <div key={i} style={{
              padding: "3rem 2rem",
              borderRight: i < 2 ? "1px solid rgba(139, 0, 20, 0.15)" : "none",
              transition: "background 0.3s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(139,0,20,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <p style={{
                fontSize: "3rem",
                fontWeight: "700",
                color: "rgba(139,0,20,0.2)",
                marginBottom: "1.5rem",
                letterSpacing: "-0.03em",
              }}>{f.num}</p>
              <h3 style={{
                fontSize: "1.1rem",
                fontWeight: "600",
                color: "#f5f0eb",
                marginBottom: "0.75rem",
              }}>{f.title}</h3>
              <p style={{
                color: "rgba(245,240,235,0.4)",
                lineHeight: "1.65",
                fontSize: "0.875rem",
              }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section style={{
        padding: "8rem 3rem",
        borderTop: "1px solid rgba(139, 0, 20, 0.15)",
        position: "relative",
        zIndex: 10,
      }}>
        <p style={{
          fontSize: "0.7rem",
          letterSpacing: "0.35em",
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
          marginBottom: "5rem",
          letterSpacing: "-0.02em",
        }}>Simple. No surprises.</h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1px",
          maxWidth: "700px",
          margin: "0 auto",
          background: "rgba(139, 0, 20, 0.15)",
        }}>
          {[
            {
              name: "Pro",
              price: "$19",
              features: ["20 videos/month", "No watermark", "1080p export", "All caption styles", "All vibes"],
              featured: false,
            },
            {
              name: "Business",
              price: "$49",
              features: ["Unlimited videos", "No watermark", "4K export", "All caption styles", "Priority rendering"],
              featured: true,
            },
          ].map((plan, i) => (
            <div key={i} style={{
              padding: "3rem 2.5rem",
              background: "#0a0406",
              position: "relative",
              outline: plan.featured ? "1px solid rgba(200,16,46,0.4)" : "none",
            }}>
              {plan.featured && (
                <p style={{
                  position: "absolute",
                  top: "-1px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#8b0014",
                  color: "white",
                  fontSize: "0.6rem",
                  letterSpacing: "0.25em",
                  textTransform: "uppercase",
                  padding: "0.25rem 1rem",
                  whiteSpace: "nowrap",
                }}>Most Popular</p>
              )}
              <p style={{
                fontSize: "0.7rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                color: "#c8102e",
                marginBottom: "1rem",
              }}>{plan.name}</p>
              <p style={{ marginBottom: "2.5rem" }}>
                <span style={{
                  fontSize: "3.5rem",
                  fontWeight: "700",
                  color: "#f5f0eb",
                  letterSpacing: "-0.03em",
                }}>{plan.price}</span>
                <span style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.85rem" }}>/month</span>
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 2.5rem" }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{
                    padding: "0.65rem 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    color: "rgba(245,240,235,0.6)",
                    fontSize: "0.875rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}>
                    <span style={{ color: "#c8102e", fontSize: "0.55rem" }}>◆</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" style={{
                display: "block",
                textAlign: "center",
                padding: "0.9rem",
                background: plan.featured ? "#8b0014" : "transparent",
                color: plan.featured ? "white" : "rgba(245,240,235,0.45)",
                textDecoration: "none",
                fontSize: "0.7rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                border: `1px solid ${plan.featured ? "#c8102e" : "rgba(255,255,255,0.1)"}`,
              }}>Get Started</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: "2.5rem 3rem",
        borderTop: "1px solid rgba(139, 0, 20, 0.15)",
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
        }}>W∆LVR</span>
        <p style={{
          color: "rgba(245,240,235,0.2)",
          fontSize: "0.75rem",
        }}>© 2026 W∆LVR. All rights reserved.</p>
      </footer>

    </main>
  );
}
