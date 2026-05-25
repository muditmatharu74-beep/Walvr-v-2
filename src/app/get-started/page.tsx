"use client";

import { useState } from "react";
import Link from "next/link";

const QUIZ = [
  {
    id: "size",
    question: "Where are you right now?",
    subtitle: "Be honest — this helps us find what actually works for you.",
    options: [
      { value: "emerging", label: "Upcoming Artist", desc: "Under 1,000 followers", tag: "< 1K" },
      { value: "growing", label: "Growing Artist", desc: "10,000 – 25,000 followers", tag: "10-25K" },
      { value: "established", label: "Established Artist", desc: "Over 25,000 followers", tag: "25K+" },
    ],
  },
  {
    id: "frequency",
    question: "How much are you posting per week?",
    subtitle: "Consistency is everything in the algorithm game.",
    options: [
      { value: "low", label: "Not Even Trying", desc: "2-3 times a week or less", tag: "2-3x" },
      { value: "mid", label: "Ideal & Consistent", desc: "4-7 times a week", tag: "4-7x" },
      { value: "high", label: "Really Going For It", desc: "More than 7 times a week", tag: "7x+" },
    ],
  },
  {
    id: "genre",
    question: "What's your genre?",
    subtitle: "Different sounds need different visuals.",
    options: [
      { value: "hiphop", label: "Hip Hop", desc: "Rap, trap, drill", tag: "🎤" },
      { value: "rnb", label: "R&B / Soul", desc: "Smooth, emotional, vocal", tag: "🎶" },
      { value: "pop", label: "Pop", desc: "Catchy, bright, mainstream", tag: "✨" },
      { value: "electronic", label: "Electronic", desc: "EDM, techno, house", tag: "⚡" },
      { value: "indie", label: "Indie / Alternative", desc: "Raw, authentic, cinematic", tag: "🎸" },
      { value: "afro", label: "Afrobeats / Dancehall", desc: "Energetic, vibrant, global", tag: "🌍" },
      { value: "latin", label: "Latin", desc: "Reggaeton, bachata, salsa", tag: "🔥" },
      { value: "other", label: "Other", desc: "Something else entirely", tag: "🎵" },
    ],
  },
];

type Recommendation = {
  plan: string;
  templates: string[];
  pacing: string;
  tip: string;
};

function getRecommendation(answers: Record<string, string>): Recommendation {
  const { size, frequency, genre } = answers;

  const fastGenres = ["hiphop", "electronic", "afro", "latin"];
  const slowGenres = ["rnb", "indie"];
  const isFast = fastGenres.includes(genre);
  const isSlow = slowGenres.includes(genre);

  let plan = "pro";
  if (size === "emerging" && frequency === "low") plan = "starter";
  if (size === "established" || frequency === "high") plan = "business";

  let templates: string[] = [];
  if (isFast) templates = ["Color Block", "Karaoke Pop", "Neon Blue"];
  else if (isSlow) templates = ["Dark Lyrics", "Cinematic", "Rain Window"];
  else templates = ["Dark Lyrics", "Color Block", "Neon Blue"];

  let pacing = "mixed cuts";
  if (isFast && frequency !== "low") pacing = "fast cuts (2-3 seconds)";
  else if (isSlow) pacing = "slow cinematic cuts (6-8 seconds)";

  let tip = "";
  if (size === "emerging" && frequency === "low") tip = "Start with 3 videos a week minimum. Consistency matters more than perfection at your stage.";
  else if (size === "growing") tip = "You've got the audience — now feed the algorithm. Daily posting will accelerate your growth significantly.";
  else if (size === "established") tip = "At your level quality and consistency both matter. Use 4K export and premium templates to match your brand.";
  else tip = "Upload your song and let Walvr handle the content. Focus on the music.";

  return { plan, templates, pacing, tip };
}

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 9,
    annualPrice: 90,
    features: ["10 videos/month", "No watermark", "1080p export", "3 templates"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 19,
    annualPrice: 190,
    features: ["Unlimited videos", "No watermark", "1080p export", "All templates", "Priority support"],
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 49,
    annualPrice: 490,
    features: ["Unlimited videos", "No watermark", "4K export", "All templates", "New templates monthly"],
  },
];

export default function GetStartedPage() {
  const [step, setStep] = useState<"quiz" | "results">("quiz");
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  function handleAnswer(questionId: string, value: string) {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    if (quizStep < QUIZ.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      setRecommendation(getRecommendation(newAnswers));
      setStep("results");
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #1a0508 0%, #150305 40%, #1a0609 100%)",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#f5f0eb",
      position: "relative",
      overflow: "hidden",
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

      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "60vh", background: "radial-gradient(ellipse at center, rgba(139,0,20,0.1) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "160px", pointerEvents: "none", zIndex: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "3px", padding: "0 2rem", opacity: 0.08 }}>
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: "#c8102e", borderRadius: "2px 2px 0 0", animation: `wave${i % 8} ${1.5 + (i % 5) * 0.3}s ease-in-out infinite alternate`, animationDelay: `${(i % 7) * 0.15}s` }} />
        ))}
      </div>

      <nav style={{ padding: "1.5rem 3rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 10 }}>
        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase", textDecoration: "none" }}>W∆LVR</Link>
        <Link href="/login" style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(245,240,235,0.4)", textDecoration: "none", border: "1px solid rgba(255,255,255,0.08)", padding: "0.6rem 1.25rem" }}>Sign In</Link>
      </nav>

      <div style={{ padding: "3rem 3rem", maxWidth: "860px", margin: "0 auto", position: "relative", zIndex: 10 }}>

        {step === "quiz" && (
          <>
            <div style={{ marginBottom: "3rem" }}>
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>
                Step {quizStep + 1} of {QUIZ.length}
              </p>
              <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1", marginBottom: "0.75rem" }}>
                {QUIZ[quizStep].question}
              </h1>
              <p style={{ color: "rgba(245,240,235,0.35)", fontSize: "0.9rem" }}>{QUIZ[quizStep].subtitle}</p>
            </div>

            <div style={{ display: "flex", gap: "6px", marginBottom: "3rem" }}>
              {QUIZ.map((_, i) => (
                <div key={i} style={{ flex: 1, height: "2px", background: i <= quizStep ? "#c8102e" : "rgba(255,255,255,0.08)", transition: "background 0.3s" }} />
              ))}
            </div>

            <div style={{
              display: "grid",
             gridTemplateColumns: QUIZ[quizStep].options.length > 4 ? "repeat(auto-fill, minmax(220px, 1fr))" : "1fr",
              gap: "1px",
              background: "rgba(200,16,46,0.08)",
              border: "1px solid rgba(200,16,46,0.08)",
            }}>
              {QUIZ[quizStep].options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(QUIZ[quizStep].id, opt.value)}
                  style={{
                    padding: "2.25rem 2rem",
                    background: "rgba(13,3,5,0.5)",
                    border: "none",
                    borderLeft: "2px solid transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    backdropFilter: "blur(8px)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(139,0,20,0.15)";
                    (e.currentTarget as HTMLElement).style.borderLeft = "2px solid #c8102e";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(13,3,5,0.5)";
                    (e.currentTarget as HTMLElement).style.borderLeft = "2px solid transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.65rem", letterSpacing: "0.15em", color: "#c8102e", border: "1px solid rgba(200,16,46,0.3)", padding: "0.15rem 0.5rem" }}>{opt.tag}</span>
                  </div>
                  <p style={{ fontSize: "1.2rem", fontWeight: "600", color: "#f5f0eb", marginBottom: "0.5rem" }}>{opt.label}</p>
                  <p style={{ fontSize: "0.9rem", color: "rgba(245,240,235,0.4)", lineHeight: "1.5" }}>{opt.desc}</p>
                </button>
              ))}
            </div>

            {quizStep > 0 && (
              <button onClick={() => setQuizStep(quizStep - 1)} style={{ marginTop: "1.5rem", background: "transparent", border: "none", color: "rgba(245,240,235,0.3)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif" }}>
                ← Back
              </button>
            )}
          </>
        )}

        {step === "results" && recommendation && (
          <>
            <div style={{ marginBottom: "3rem" }}>
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>Your Results</p>
              <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1", marginBottom: "0.75rem" }}>
                Here's what works for you.
              </h1>
              <p style={{ color: "rgba(245,240,235,0.35)", fontSize: "0.9rem", maxWidth: "560px", lineHeight: "1.6" }}>{recommendation.tip}</p>
            </div>

            {/* Recommendations box */}
            <div style={{ border: "1px solid rgba(200,16,46,0.15)", background: "rgba(139,0,20,0.08)", backdropFilter: "blur(8px)", padding: "2rem", marginBottom: "3rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "2rem" }}>
              <div>
                <p style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,235,0.3)", marginBottom: "0.5rem" }}>Best Templates For You</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {recommendation.templates.map((t, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#c8102e", fontSize: "0.5rem" }}>◆</span>
                      <span style={{ color: "#f5f0eb", fontSize: "0.875rem" }}>{t}</span>
                      {i === 0 && <span style={{ fontSize: "0.55rem", letterSpacing: "0.15em", color: "#c8102e", border: "1px solid rgba(200,16,46,0.3)", padding: "0.1rem 0.4rem" }}>TOP PICK</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,235,0.3)", marginBottom: "0.5rem" }}>Recommended Pacing</p>
                <p style={{ color: "#f5f0eb", fontSize: "0.95rem", fontWeight: "600" }}>{recommendation.pacing}</p>
              </div>
              <div>
                <p style={{ fontSize: "0.65rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,235,0.3)", marginBottom: "0.5rem" }}>Recommended Plan</p>
                <p style={{ color: "#c8102e", fontSize: "1.1rem", fontWeight: "700", textTransform: "capitalize" }}>{recommendation.plan}</p>
              </div>
            </div>

            {/* Billing toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2rem" }}>
              <div style={{ display: "flex", background: "rgba(13,3,5,0.6)", border: "1px solid rgba(200,16,46,0.12)", padding: "4px" }}>
                {(["monthly", "annual"] as const).map((b) => (
                  <button key={b} onClick={() => setBilling(b)} style={{ padding: "0.5rem 1.25rem", background: billing === b ? "#8b0014" : "transparent", color: billing === b ? "#f5f0eb" : "rgba(245,240,235,0.35)", border: "none", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s", fontFamily: "'Georgia', serif" }}>{b}</button>
                ))}
              </div>
              {billing === "annual" && (
                <span style={{ fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)", padding: "0.25rem 0.75rem" }}>2 months free</span>
              )}
            </div>

            {/* Plans */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1px", background: "rgba(200,16,46,0.08)", marginBottom: "2rem" }}>
              {PLANS.map((p) => {
                const isRec = p.id === recommendation.plan;
                const price = billing === "annual" ? p.annualPrice : p.monthlyPrice;
                const period = billing === "annual" ? "/year" : "/month";

                return (
                  <div key={p.id} style={{
                    padding: "2.5rem 2rem",
                    background: isRec ? "rgba(139,0,20,0.15)" : "rgba(13,3,5,0.6)",
                    backdropFilter: "blur(10px)",
                    position: "relative",
                    borderTop: isRec ? "2px solid #c8102e" : "2px solid transparent",
                  }}>
                    {isRec && (
                      <div style={{ position: "absolute", top: "-1px", left: "50%", transform: "translateX(-50%)", background: "#8b0014", color: "white", fontSize: "0.6rem", letterSpacing: "0.25em", textTransform: "uppercase", padding: "0.25rem 1rem", whiteSpace: "nowrap" }}>
                        Recommended for You
                      </div>
                    )}

                    <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>{p.name}</p>

                    <div style={{ marginBottom: "2rem" }}>
                      <span style={{ fontSize: "3rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.03em" }}>${price}</span>
                      <span style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.85rem" }}>{period}</span>
                      {billing === "annual" && (
                        <p style={{ fontSize: "0.7rem", color: "rgba(245,240,235,0.25)", marginTop: "0.25rem" }}>${Math.round(price / 12)}/mo billed annually</p>
                      )}
                    </div>

                    <ul style={{ listStyle: "none", padding: 0, marginBottom: "2rem" }}>
                      {p.features.map((f, j) => (
                        <li key={j} style={{ padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(245,240,235,0.6)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                          <span style={{ color: "#c8102e", fontSize: "0.55rem" }}>◆</span>
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={`/signup?plan=${p.id}&billing=${billing}`}
                      style={{
                        display: "block",
                        textAlign: "center",
                        padding: "0.9rem",
                        background: isRec ? "#8b0014" : "transparent",
                        color: "#f5f0eb",
                        textDecoration: "none",
                        fontSize: "0.75rem",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        border: `1px solid ${isRec ? "rgba(200,16,46,0.6)" : "rgba(200,16,46,0.25)"}`,
                      }}
                    >
                      Get {p.name} →
                    </Link>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "2rem" }}>
              <button onClick={() => { setStep("quiz"); setQuizStep(0); setAnswers({}); }} style={{ background: "transparent", border: "none", color: "rgba(245,240,235,0.3)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif" }}>
                ← Retake Quiz
              </button>
              <Link href="/signup" style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", textDecoration: "none" }}>
                Skip to Signup →
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
