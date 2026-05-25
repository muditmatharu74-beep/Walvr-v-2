"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSent(true);
    setLoading(false);
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #1a0508 0%, #150305 40%, #1a0609 100%)",
      fontFamily: "'Georgia', 'Times New Roman', serif",
      color: "#f5f0eb",
      display: "flex",
      flexDirection: "column",
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
        input::placeholder { color: rgba(245,240,235,0.2); }
        input:focus { border-color: rgba(200,16,46,0.4) !important; outline: none; }
      `}</style>

      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "60vh", background: "radial-gradient(ellipse at center, rgba(139,0,20,0.18) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "160px", pointerEvents: "none", zIndex: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "3px", padding: "0 2rem", opacity: 0.08 }}>
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: "#c8102e", borderRadius: "2px 2px 0 0", animation: `wave${i % 8} ${1.5 + (i % 5) * 0.3}s ease-in-out infinite alternate`, animationDelay: `${(i % 7) * 0.15}s` }} />
        ))}
      </div>

      <nav style={{ padding: "1.5rem 3rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 10 }}>
        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase", textDecoration: "none" }}>W∆LVR</Link>
        <Link href="/login" style={{ fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(245,240,235,0.4)", textDecoration: "none", border: "1px solid rgba(255,255,255,0.08)", padding: "0.6rem 1.25rem" }}>Sign In</Link>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 3rem", position: "relative", zIndex: 10 }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>

          {!sent ? (
            <>
              <div style={{ marginBottom: "3rem" }}>
                <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>Password Reset</p>
                <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1" }}>Forgot Password</h1>
                <p style={{ color: "rgba(245,240,235,0.35)", marginTop: "0.75rem", fontSize: "0.9rem" }}>Enter your email and we'll send you a reset link.</p>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <label style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.35)", display: "block", marginBottom: "0.6rem" }}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    style={{ width: "100%", padding: "1rem 1.25rem", background: "rgba(20,5,8,0.7)", border: "1px solid rgba(200,16,46,0.2)", color: "#f5f0eb", fontSize: "1rem", fontFamily: "'Georgia', serif", boxSizing: "border-box" }}
                  />
                </div>

                {error && <p style={{ color: "#c8102e", fontSize: "0.8rem" }}>{error}</p>}

                <button type="submit" disabled={loading} style={{ padding: "1rem", background: "#8b0014", color: "#f5f0eb", border: "1px solid rgba(200,16,46,0.6)", fontSize: "0.8rem", letterSpacing: "0.2em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "'Georgia', serif" }}>
                  {loading ? "Sending..." : "Send Reset Link →"}
                </button>
              </form>

              <p style={{ marginTop: "2rem", fontSize: "0.8rem", color: "rgba(245,240,235,0.3)", textAlign: "center" }}>
                Remember it?{" "}
                <Link href="/login" style={{ color: "#c8102e", textDecoration: "none" }}>Sign in</Link>
              </p>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>Check Your Email</p>
              <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1", marginBottom: "1.5rem" }}>Reset link sent.</h1>
              <p style={{ color: "rgba(245,240,235,0.4)", fontSize: "0.9rem", lineHeight: "1.6", marginBottom: "2.5rem" }}>
                We sent a password reset link to <span style={{ color: "#f5f0eb" }}>{email}</span>. Check your inbox and follow the link to reset your password.
              </p>
              <Link href="/login" style={{ display: "inline-block", padding: "1rem 2.5rem", background: "#8b0014", color: "#f5f0eb", textDecoration: "none", fontSize: "0.8rem", letterSpacing: "0.2em", textTransform: "uppercase", border: "1px solid rgba(200,16,46,0.6)" }}>
                Back to Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
