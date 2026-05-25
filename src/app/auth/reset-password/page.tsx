"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setError(error.message); setLoading(false); return; }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
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
        input::placeholder { color: rgba(245,240,235,0.2); }
        input:focus { border-color: rgba(200,16,46,0.4) !important; outline: none; }
      `}</style>

      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "60vh", background: "radial-gradient(ellipse at center, rgba(139,0,20,0.18) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <nav style={{ padding: "1.5rem 3rem", display: "flex", alignItems: "center", position: "relative", zIndex: 10 }}>
        <Link href="/" style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase", textDecoration: "none" }}>W∆LVR</Link>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 3rem", position: "relative", zIndex: 10 }}>
        <div style={{ width: "100%", maxWidth: "420px" }}>
          {!done ? (
            <>
              <div style={{ marginBottom: "3rem" }}>
                <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>New Password</p>
                <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1" }}>Reset Password</h1>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div>
                  <label style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.35)", display: "block", marginBottom: "0.6rem" }}>New Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="••••••••" style={{ width: "100%", padding: "1rem 1.25rem", background: "rgba(20,5,8,0.7)", border: "1px solid rgba(200,16,46,0.2)", color: "#f5f0eb", fontSize: "1rem", fontFamily: "'Georgia', serif", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.65rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.35)", display: "block", marginBottom: "0.6rem" }}>Confirm Password</label>
                  <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="••••••••" style={{ width: "100%", padding: "1rem 1.25rem", background: "rgba(20,5,8,0.7)", border: "1px solid rgba(200,16,46,0.2)", color: "#f5f0eb", fontSize: "1rem", fontFamily: "'Georgia', serif", boxSizing: "border-box" }} />
                </div>

                {error && <p style={{ color: "#c8102e", fontSize: "0.8rem" }}>{error}</p>}

                <button type="submit" disabled={loading} style={{ padding: "1rem", background: "#8b0014", color: "#f5f0eb", border: "1px solid rgba(200,16,46,0.6)", fontSize: "0.8rem", letterSpacing: "0.2em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "'Georgia', serif" }}>
                  {loading ? "Updating..." : "Update Password →"}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "1rem" }}>Success</p>
              <h1 style={{ fontSize: "2.5rem", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1", marginBottom: "1rem" }}>Password updated.</h1>
              <p style={{ color: "rgba(245,240,235,0.4)", fontSize: "0.9rem" }}>Redirecting you to dashboard...</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
