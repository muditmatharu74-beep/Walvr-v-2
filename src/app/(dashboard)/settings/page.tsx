"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const QUIZ = [
  {
    id: "frequency",
    question: "How often do you post content?",
    options: [
      { value: "casual", label: "Just starting out", desc: "1-2 times a month" },
      { value: "regular", label: "Regularly", desc: "1-2 times a week" },
      { value: "daily", label: "Daily grind", desc: "Every day" },
    ],
  },
  {
    id: "goal",
    question: "What matters most to you?",
    options: [
      { value: "try", label: "Just trying it out", desc: "See if it works for me" },
      { value: "grow", label: "Growing my audience", desc: "More views, more followers" },
      { value: "pro", label: "Professional quality", desc: "No watermark, no compromise" },
    ],
  },
  {
    id: "platform",
    question: "Where do you post?",
    options: [
      { value: "tiktok", label: "TikTok", desc: "Short form, trends fast" },
      { value: "reels", label: "Instagram Reels", desc: "Visual, aesthetic focused" },
      { value: "youtube", label: "YouTube Shorts", desc: "Longer shelf life" },
      { value: "all", label: "All of them", desc: "Maximum reach" },
    ],
  },
];

function getRecommendedPlan(answers: Record<string, string>): string {
  const { frequency, goal } = answers;
  if (goal === "try" || frequency === "casual") return "starter";
  if (goal === "pro" || frequency === "daily") return "business";
  return "pro";
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizDone, setQuizDone] = useState(false);
  const [recommendedPlan, setRecommendedPlan] = useState("");

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      const result = await supabase.auth.getUser();
      const currentUser = result.data.user;
      if (!currentUser) { router.push("/login"); return; }
      setUser(currentUser);
      const profileResult = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
      setProfile(profileResult.data);
    }
    load();
  }, []);

  async function handleUpgrade(priceId: string) {
    setLoading(true);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    if (data.url) router.push(data.url);
    else setLoading(false);
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  function handleQuizAnswer(questionId: string, value: string) {
    const newAnswers = { ...quizAnswers, [questionId]: value };
    setQuizAnswers(newAnswers);
    if (quizStep < QUIZ.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      const rec = getRecommendedPlan(newAnswers);
      setRecommendedPlan(rec);
      setQuizDone(true);
    }
  }

  const plan = profile?.plan ?? "free";

  const plans = [
    {
      id: "starter",
      name: "Starter",
      monthlyPrice: 9,
      annualPrice: 90,
      priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID ?? "",
      features: ["10 videos/month", "No watermark", "1080p export", "3 templates"],
      cta: "Get Starter",
    },
    {
      id: "pro",
      name: "Pro",
      monthlyPrice: 19,
      annualPrice: 190,
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "",
      features: ["Unlimited videos", "No watermark", "1080p export", "All templates", "Priority support"],
      cta: "Get Pro",
    },
    {
      id: "business",
      name: "Business",
      monthlyPrice: 49,
      annualPrice: 490,
      priceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID ?? "",
      features: ["Unlimited videos", "No watermark", "4K export", "All templates", "Priority support", "New templates monthly"],
      cta: "Get Business",
    },
  ];

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

      <nav style={{ borderBottom: "1px solid rgba(200,16,46,0.12)", padding: "1.25rem 3rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(13,3,5,0.75)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
        <span style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase" }}>W∆LVR</span>
        <button onClick={() => router.push("/dashboard")} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,235,0.45)", padding: "0.6rem 1.5rem", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>← Dashboard</button>
      </nav>

      <div style={{ padding: "4rem 3rem", maxWidth: "900px", margin: "0 auto", position: "relative", zIndex: 10 }}>

        <div style={{ marginBottom: "4rem" }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>Account</p>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1" }}>Settings</h1>
          <p style={{ color: "rgba(245,240,235,0.35)", fontSize: "0.9rem", marginTop: "0.5rem" }}>{user?.email} · {plan} plan</p>
        </div>

        {/* Quiz or Pricing */}
        {plan === "free" && !quizDone ? (
          <div style={{ marginBottom: "4rem" }}>
            <div style={{ marginBottom: "2rem" }}>
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>
                Question {quizStep + 1} of {QUIZ.length}
              </p>
              <h2 style={{ fontSize: "1.8rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
                {QUIZ[quizStep].question}
              </h2>
              <div style={{ display: "flex", gap: "6px", marginBottom: "2rem" }}>
                {QUIZ.map((_, i) => (
                  <div key={i} style={{ flex: 1, height: "2px", background: i <= quizStep ? "#c8102e" : "rgba(255,255,255,0.08)", transition: "background 0.3s" }} />
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1px", background: "rgba(200,16,46,0.08)", border: "1px solid rgba(200,16,46,0.08)" }}>
              {QUIZ[quizStep].options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleQuizAnswer(QUIZ[quizStep].id, opt.value)}
                  style={{
                    padding: "1.75rem 1.5rem",
                    background: "rgba(13,3,5,0.5)",
                    border: "none",
                    borderLeft: "2px solid transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s",
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
                  <p style={{ fontSize: "1rem", fontWeight: "600", color: "#f5f0eb", marginBottom: "0.3rem" }}>{opt.label}</p>
                  <p style={{ fontSize: "0.75rem", color: "rgba(245,240,235,0.35)" }}>{opt.desc}</p>
                </button>
              ))}
            </div>

            {quizStep > 0 && (
              <button
                onClick={() => setQuizStep(quizStep - 1)}
                style={{ marginTop: "1.5rem", background: "transparent", border: "none", color: "rgba(245,240,235,0.3)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}
              >
                ← Back
              </button>
            )}
          </div>
        ) : (
          <>
            {recommendedPlan && (
              <div style={{ marginBottom: "2rem", padding: "1rem 1.5rem", background: "rgba(139,0,20,0.12)", border: "1px solid rgba(200,16,46,0.2)", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c8102e" }}>◆ Our recommendation</span>
                <span style={{ fontSize: "0.9rem", color: "#f5f0eb" }}>
                  Based on your answers, <strong>{recommendedPlan.charAt(0).toUpperCase() + recommendedPlan.slice(1)}</strong> is the best fit for you.
                </span>
                {plan !== "free" && (
                  <button onClick={() => { setQuizDone(false); setQuizStep(0); setQuizAnswers({}); }} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "rgba(245,240,235,0.3)", fontSize: "0.7rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>
                    Retake
                  </button>
                )}
              </div>
            )}

            {/* Billing toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2.5rem" }}>
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.4)" }}>Billing</p>
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1px", background: "rgba(200,16,46,0.08)", marginBottom: "4rem" }}>
              {plans.map((p) => {
                const isCurrent = plan === p.id;
                const isRecommended = recommendedPlan === p.id;
                const price = billing === "annual" ? p.annualPrice : p.monthlyPrice;
                const period = billing === "annual" ? "/year" : "/month";

                return (
                  <div key={p.id} style={{
                    padding: "2.5rem 2rem",
                    background: isRecommended ? "rgba(139,0,20,0.15)" : "rgba(13,3,5,0.6)",
                    backdropFilter: "blur(10px)",
                    position: "relative",
                    borderTop: isRecommended ? "2px solid #c8102e" : isCurrent ? "2px solid rgba(200,16,46,0.4)" : "2px solid transparent",
                    transition: "all 0.2s",
                  }}>
                    {isRecommended && (
                      <div style={{ position: "absolute", top: "-1px", left: "50%", transform: "translateX(-50%)", background: "#8b0014", color: "white", fontSize: "0.6rem", letterSpacing: "0.25em", textTransform: "uppercase", padding: "0.25rem 1rem", whiteSpace: "nowrap" }}>
                        Recommended for You
                      </div>
                    )}

                    {isCurrent && (
                      <div style={{ position: "absolute", top: "1.25rem", right: "1.25rem", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c8102e", border: "1px solid rgba(200,16,46,0.3)", padding: "0.2rem 0.6rem" }}>Current</div>
                    )}

                    <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>{p.name}</p>

                    <div style={{ marginBottom: "2rem" }}>
                      <span style={{ fontSize: "3rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.03em" }}>${price}</span>
                      <span style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.85rem" }}>{period}</span>
                      {billing === "annual" && (
                        <p style={{ fontSize: "0.7rem", color: "rgba(245,240,235,0.25)", marginTop: "0.25rem" }}>${Math.round(price / 12)}/month billed annually</p>
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

                    <button
                      onClick={() => !isCurrent && p.priceId && handleUpgrade(p.priceId)}
                      disabled={isCurrent || loading}
                      style={{
                        width: "100%",
                        padding: "0.9rem",
                        background: isCurrent ? "transparent" : isRecommended ? "#8b0014" : "transparent",
                        color: isCurrent ? "rgba(245,240,235,0.25)" : "#f5f0eb",
                        border: `1px solid ${isCurrent ? "rgba(255,255,255,0.06)" : isRecommended ? "rgba(200,16,46,0.6)" : "rgba(200,16,46,0.25)"}`,
                        fontSize: "0.75rem",
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        cursor: isCurrent ? "default" : "pointer",
                        transition: "all 0.2s",
                        fontFamily: "'Georgia', serif",
                      }}
                    >
                      {isCurrent ? "Current Plan" : loading ? "Loading..." : p.cta}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
       
        {/* Top-up section */}
        <div style={{ border: "1px solid rgba(200,16,46,0.1)", background: "rgba(13,3,5,0.5)", backdropFilter: "blur(8px)", padding: "2rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <div>
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,235,0.3)", marginBottom: "0.4rem" }}>Credits</p>
              <p style={{ fontSize: "2rem", fontWeight: "700", color: "#f5f0eb" }}>{profile?.credits ?? 0} <span style={{ fontSize: "0.8rem", color: "rgba(245,240,235,0.3)", fontWeight: "400" }}>remaining</span></p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "0.7rem", color: "rgba(245,240,235,0.3)", marginBottom: "0.25rem" }}>Basic video = 100 credits</p>
              <p style={{ fontSize: "0.7rem", color: "rgba(245,240,235,0.3)", marginBottom: "0.25rem" }}>Standard video = 200 credits</p>
              <p style={{ fontSize: "0.7rem", color: "rgba(245,240,235,0.3)" }}>Premium video = 350 credits</p>
            </div>
          </div>

          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.3)", marginBottom: "1rem" }}>Top Up</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1px", background: "rgba(200,16,46,0.08)" }}>
            {[
              { credits: 500, price: "$5", priceId: process.env.NEXT_PUBLIC_STRIPE_TOPUP_500_PRICE_ID ?? "" },
              { credits: 1500, price: "$12", priceId: process.env.NEXT_PUBLIC_STRIPE_TOPUP_1500_PRICE_ID ?? "" },
              { credits: 5000, price: "$35", priceId: process.env.NEXT_PUBLIC_STRIPE_TOPUP_5000_PRICE_ID ?? "" },
              { credits: 12000, price: "$79", priceId: process.env.NEXT_PUBLIC_STRIPE_TOPUP_12000_PRICE_ID ?? "" },
            ].map((pkg) => (
              <button
                key={pkg.credits}
                onClick={async () => {
                  const res = await fetch("/api/topup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ priceId: pkg.priceId, credits: pkg.credits }),
                  });
                  const data = await res.json();
                  if (data.url) window.location.href = data.url;
                }}
                style={{
                  padding: "1.5rem 1rem",
                  background: "rgba(13,3,5,0.6)",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "background 0.2s",
                  fontFamily: "'Georgia', serif",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,0,20,0.15)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(13,3,5,0.6)")}
              >
                <p style={{ fontSize: "1.25rem", fontWeight: "700", color: "#f5f0eb", marginBottom: "0.25rem" }}>{pkg.credits.toLocaleString()}</p>
                <p style={{ fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(245,240,235,0.35)", marginBottom: "0.75rem" }}>credits</p>
                <p style={{ fontSize: "0.9rem", color: "#c8102e", fontWeight: "600" }}>{pkg.price}</p>
              </button>
            ))}
          </div>
        </div>
        {/* Account section */}
        <div style={{ border: "1px solid rgba(200,16,46,0.1)", background: "rgba(13,3,5,0.5)", backdropFilter: "blur(8px)", padding: "2rem" }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,235,0.3)", marginBottom: "1.5rem" }}>Account</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <p style={{ color: "#f5f0eb", fontSize: "0.9rem", marginBottom: "0.25rem" }}>{user?.email}</p>
              <p style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>{plan} plan</p>
            </div>
            <button onClick={handleSignOut} disabled={signingOut} style={{ padding: "0.7rem 1.5rem", background: "transparent", color: "rgba(245,240,235,0.4)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif" }}>
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
