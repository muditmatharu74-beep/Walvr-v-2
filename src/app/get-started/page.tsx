"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const QUIZ = [
  {
    id: "frequency",
    question: "How often do you post content?",
    subtitle: "We'll match you with the right plan.",
    options: [
      { value: "casual", label: "Just starting out", desc: "1-2 times a month" },
      { value: "regular", label: "Regularly", desc: "1-2 times a week" },
      { value: "daily", label: "Daily grind", desc: "Every day" },
    ],
  },
  {
    id: "goal",
    question: "What's your main goal?",
    subtitle: "Tell us what matters most.",
    options: [
      { value: "try", label: "Just trying it out", desc: "See if Walvr works for me" },
      { value: "grow", label: "Grow my audience", desc: "More views, more followers" },
      { value: "pro", label: "Go fully professional", desc: "No watermark, maximum quality" },
    ],
  },
  {
    id: "platform",
    question: "Where do you post?",
    subtitle: "We optimize your videos for your platform.",
    options: [
      { value: "tiktok", label: "TikTok", desc: "Short form, trends fast" },
      { value: "reels", label: "Instagram Reels", desc: "Visual, aesthetic focused" },
      { value: "youtube", label: "YouTube Shorts", desc: "Longer shelf life" },
      { value: "all", label: "All of them", desc: "Maximum reach" },
    ],
  },
];

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 9,
    annualPrice: 90,
    features: ["10 videos/month", "No watermark", "1080p export", "3 templates"],
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "",
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 19,
    annualPrice: 190,
    features: ["Unlimited videos", "No watermark", "1080p export", "All templates", "Priority support"],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "",
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: 49,
    annualPrice: 490,
    features: ["Unlimited videos", "No watermark", "4K export", "All templates", "New templates monthly"],
    priceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID ?? "",
  },
];

function getRecommendedPlan(answers: Record<string, string>): string {
  const { frequency, goal } = answers;
  if (goal === "try" || frequency === "casual") return "starter";
  if (goal === "pro" || frequency === "daily") return "business";
  return "pro";
}

export default function GetStartedPage() {
  const router = useRouter();
  const [step, setStep] = useState<"quiz" | "plans">("quiz");
  const [quizStep, setQuizStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [recommendedPlan, setRecommendedPlan] = useState("");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");

  function handleAnswer(questionId: string, value: string) {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    if (quizStep < QUIZ.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      setRecommendedPlan(getRecommendedPlan(newAnswers));
      setStep("plans");
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
        button:hover { opacity: 0.9; }
      `}</style>

      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "60vh", background: "radial-gradient(ellipse at center, rgba(139,0,20,0.1) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "160px", pointerEvents: "none", zIndex: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "3px", padding: "0 2rem", opacity: 0.08 }}>
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: "#c8102e", borderRadius: "2px 2px 0 0", animation: `wave${i % 8} ${1.5 + (i % 5) * 0.3}s ease-in-out infinite alternate`, animationDelay: `${(i % 7) * 0.15}s` }} />
        ))}
      </div>

      {/* Nav */}
      <nav style={{ padding: "1.5rem 3rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 10 }}>
        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase", textDecoration: "none" }}>W∆LVR</Link>
        <Link href="/login" style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(245,240,235,0.4)", textDecoration: "none", border: "1px solid rgba(255,255,255,0.08)", padding: "0.6rem 1.25rem" }}>Sign In</Link>
      </nav>

      <div style={{ padding: "3rem 3rem", maxWidth: "800px", margin: "0 auto", position: "relative", zIndex: 10 }}>

        {/* Quiz */}
        {step === "quiz" && (
          <>
            <div style={{ marginBottom: "3rem" }}>
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>
                Question {quizStep + 1} of {QUIZ.length}
              </p>
              <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1", marginBottom: "0.75rem" }}>
                {QUIZ[quizStep].question}
              </h1>
              <p style={{ color: "rgba(245,240,235,0.35)", fontSize: "0.9rem" }}>{QUIZ[quizStep].subtitle}</p>
            </div>

            {/* Progress */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "3rem" }}>
              {QUIZ.map((_, i) => (
                <div key={i} style={{ flex: 1, height: "2px", background: i <= quizStep ? "#c8102e" : "rgba(255,255,255,0.08)", transition: "background 0.3s" }} />
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1px", background: "rgba(200,16,46,0.08)", border: "1px solid rgba(200,16,46,0.08)" }}>
              {QUIZ[quizStep].options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleAnswer(QUIZ[quizStep].id, opt.value)}
                  style={{
                    padding: "2rem 1.5rem",
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
                  <p style={{ fontSize: "1rem", fontWeight: "600", color: "#f5f0eb", marginBottom: "0.4rem" }}>{opt.label}</p>
                  <p style={{ fontSize: "0.75rem", color: "rgba(245,240,235,0.35)", lineHeight: "1.4" }}>{opt.desc}</p>
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

        {/* Plans */}
        {step === "plans" && (
          <>
            <div style={{ marginBottom: "3rem" }}>
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>Your Recommendation</p>
              <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 3rem)", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1", marginBottom: "0.75rem" }}>
                We found your perfect plan.
              </h1>
              <p style={{ color: "rgba(245,240,235,0.35)", fontSize: "0.9rem" }}>
                Based on your answers, we recommend <span style={{ color: "#c8102e" }}>{recommendedPlan.charAt(0).toUpperCase() + recommendedPlan.slice(1)}</span>. You can always change later.
              </p>
            </div>

            {/* Billing toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2.5rem" }}>
              <div style={{ display: "flex", background: "rgba(13,3,5,0.6)", border: "1px solid rgba(200,16,46,0.12)", padding: "4px" }}>
                {(["monthly", "annual"] as const).map((b) => (
                  <button key={b} onClick={() => setBilling(b)} style={{ padding: "0.5rem 1.25rem", background: billing === b ? "#8b0014" : "transparent", color: billing === b ? "#f5f0eb" : "rgba(245,240,235,0.35)", border: "none", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s", fontFamily: "'Georgia', serif" }}>{b}</button>
                ))}
              </div>
              {billing === "annual" && (
                <span style={{ fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)", padding: "0.25rem 0.75rem" }}>2 months free</span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1px", background: "rgba(200,16,46,0.08)", marginBottom: "2rem" }}>
              {PLANS.map((p) => {
                const isRec = p.id === recommendedPlan;
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
                        transition: "all 0.2s",
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
                Skip →
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
