"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loading, setLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const plan = profile?.plan ?? "free";

  const plans = [
    {
      id: "free",
      name: "Free",
      monthlyPrice: 0,
      annualPrice: 0,
      priceId: null,
      features: ["3 videos/month", "Watermark", "1080p export", "All vibes", "All caption styles"],
      color: "rgba(255,255,255,0.04)",
      borderColor: "rgba(255,255,255,0.06)",
      accent: "rgba(245,240,235,0.3)",
      cta: "Current Plan",
      disabled: true,
    },
    {
      id: "pro",
      name: "Pro",
      monthlyPrice: 19,
      annualPrice: 190,
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID ?? "",
      features: ["20 videos/month", "No watermark", "1080p export", "All vibes", "All caption styles", "Priority support"],
      color: "rgba(139,0,20,0.12)",
      borderColor: "rgba(200,16,46,0.25)",
      accent: "#c8102e",
      cta: "Upgrade to Pro",
      disabled: false,
    },
    {
      id: "business",
      name: "Business",
      monthlyPrice: 49,
      annualPrice: 490,
      priceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID ?? "",
      features: ["Unlimited videos", "No watermark", "4K export", "All vibes", "All caption styles", "Priority support", "Custom templates"],
      color: "linear-gradient(135deg, rgba(139,0,20,0.2) 0%, rgba(30,0,60,0.2) 50%, rgba(0,20,80,0.2) 100%)",
      borderColor: "rgba(200,16,46,0.4)",
      accent: "#c8102e",
      cta: "Upgrade to Business",
      disabled: false,
      featured: true,
    },
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
        @keyframes wave0 { from { height: 8px; } to { height: 40px; } }
        @keyframes wave1 { from { height: 12px; } to { height: 80px; } }
        @keyframes wave2 { from { height: 6px; } to { height: 55px; } }
        @keyframes wave3 { from { height: 10px; } to { height: 100px; } }
        @keyframes wave4 { from { height: 8px; } to { height: 65px; } }
        @keyframes wave5 { from { height: 15px; } to { height: 45px; } }
        @keyframes wave6 { from { height: 5px; } to { height: 90px; } }
        @keyframes wave7 { from { height: 10px; } to { height: 70px; } }
      `}</style>

      {/* Radial glow */}
      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "60vh", background: "radial-gradient(ellipse at center, rgba(139,0,20,0.07) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Waveform */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "160px", pointerEvents: "none", zIndex: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "3px", padding: "0 2rem", opacity: 0.08 }}>
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: "#c8102e", borderRadius: "2px 2px 0 0", animation: `wave${i % 8} ${1.5 + (i % 5) * 0.3}s ease-in-out infinite alternate`, animationDelay: `${(i % 7) * 0.15}s` }} />
        ))}
      </div>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(200,16,46,0.12)", padding: "1.25rem 3rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(13,3,5,0.75)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
        <span style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase" }}>W∆LVR</span>
        <button onClick={() => router.push("/dashboard")} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,235,0.45)", padding: "0.6rem 1.5rem", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>← Dashboard</button>
      </nav>

      <div style={{ padding: "4rem 3rem", maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 10 }}>

        {/* Header */}
        <div style={{ marginBottom: "4rem" }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>Account</p>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1", marginBottom: "0.75rem" }}>Settings</h1>
          <p style={{ color: "rgba(245,240,235,0.35)", fontSize: "0.9rem" }}>{user?.email}</p>
        </div>

        {/* Billing toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "3rem" }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.4)" }}>Billing</p>
          <div style={{ display: "flex", background: "rgba(13,3,5,0.6)", border: "1px solid rgba(200,16,46,0.12)", padding: "4px" }}>
            {(["monthly", "annual"] as const).map((b) => (
              <button key={b} onClick={() => setBilling(b)} style={{
                padding: "0.5rem 1.25rem",
                background: billing === b ? "#8b0014" : "transparent",
                color: billing === b ? "#f5f0eb" : "rgba(245,240,235,0.35)",
                border: "none",
                fontSize: "0.7rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all 0.2s",
              }}>{b}</button>
            ))}
          </div>
          {billing === "annual" && (
            <span style={{ fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)", padding: "0.25rem 0.75rem" }}>
              2 months free
            </span>
          )}
        </div>

        {/* Plans */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1px", background: "rgba(200,16,46,0.08)", marginBottom: "4rem" }}>
          {plans.map((p) => {
            const isCurrent = plan === p.id;
            const price = billing === "annual" ? p.annualPrice : p.monthlyPrice;
            const period = billing === "annual" ? "/year" : "/month";

            return (
              <div key={p.id} style={{
                padding: "2.5rem 2rem",
                background: p.featured ? p.color : `rgba(13,3,5,0.6)`,
                backdropFilter: "blur(10px)",
                position: "relative",
                borderTop: isCurrent ? `2px solid ${p.accent}` : "2px solid transparent",
                transition: "all 0.2s",
              }}>
                {p.featured && (
                  <div style={{ position: "absolute", top: "-1px", left: "50%", transform: "translateX(-50%)", background: "#8b0014", color: "white", fontSize: "0.6rem", letterSpacing: "0.25em", textTransform: "uppercase", padding: "0.25rem 1rem", whiteSpace: "nowrap" }}>
                    Most Popular
                  </div>
                )}

                {isCurrent && (
                  <div style={{ position: "absolute", top: "1.25rem", right: "1.25rem", fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: p.accent, border: `1px solid ${p.borderColor}`, padding: "0.2rem 0.6rem" }}>
                    Current
                  </div>
                )}

                <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: p.accent, marginBottom: "1rem" }}>{p.name}</p>

                <div style={{ marginBottom: "2rem" }}>
                  <span style={{ fontSize: "3rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.03em" }}>
                    {price === 0 ? "Free" : `$${price}`}
                  </span>
                  {price > 0 && <span style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.85rem" }}>{period}</span>}
                  {billing === "annual" && price > 0 && (
                    <p style={{ fontSize: "0.7rem", color: "rgba(245,240,235,0.25)", marginTop: "0.25rem" }}>
                      ${Math.round(price / 12)}/month billed annually
                    </p>
                  )}
                </div>

                <ul style={{ listStyle: "none", padding: 0, marginBottom: "2rem" }}>
                  {p.features.map((f, j) => (
                    <li key={j} style={{ padding: "0.6rem 0", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(245,240,235,0.6)", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <span style={{ color: p.accent, fontSize: "0.55rem" }}>◆</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !isCurrent && !p.disabled && p.priceId && handleUpgrade(p.priceId)}
                  disabled={isCurrent || p.disabled || loading}
                  style={{
                    width: "100%",
                    padding: "0.9rem",
                    background: isCurrent ? "transparent" : p.featured ? "#8b0014" : "transparent",
                    color: isCurrent ? "rgba(245,240,235,0.25)" : "#f5f0eb",
                    border: `1px solid ${isCurrent ? "rgba(255,255,255,0.06)" : p.featured ? "rgba(200,16,46,0.6)" : "rgba(200,16,46,0.25)"}`,
                    fontSize: "0.75rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    cursor: isCurrent || p.disabled ? "default" : "pointer",
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

        {/* Account section */}
        <div style={{ border: "1px solid rgba(200,16,46,0.1)", background: "rgba(13,3,5,0.5)", backdropFilter: "blur(8px)", padding: "2rem" }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(245,240,235,0.3)", marginBottom: "1.5rem" }}>Account</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
            <div>
              <p style={{ color: "#f5f0eb", fontSize: "0.9rem", marginBottom: "0.25rem" }}>{user?.email}</p>
              <p style={{ color: "rgba(245,240,235,0.3)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>{plan} plan</p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{ padding: "0.7rem 1.5rem", background: "transparent", color: "rgba(245,240,235,0.4)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif" }}
            >
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>

      </div>
    </main>
  );
}
