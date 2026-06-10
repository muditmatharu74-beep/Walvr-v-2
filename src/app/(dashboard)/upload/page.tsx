"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CAPTION_STYLES = [
  { id: "bold-overlay", label: "Bold", desc: "Big white centered text", preview: { text: "WORDS", glow: false, bottom: false, yellow: false } },
  { id: "word-highlight", label: "Highlight", desc: "Text with subtle background", preview: { text: "WORDS", highlight: true, glow: false, bottom: false, yellow: false } },
  { id: "frosted", label: "Frosted", desc: "White text with glow effect", preview: { text: "WORDS", glow: true, bottom: false, yellow: false } },
  { id: "minimal", label: "Minimal", desc: "Small clean text at bottom", preview: { text: "words", glow: false, bottom: true, yellow: false } },
  { id: "karaoke", label: "Karaoke", desc: "Yellow text with white stroke", preview: { text: "WORDS", glow: false, bottom: false, yellow: true } },
];

const PLAN_ORDER = ["free", "starter", "pro", "business"];

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "template" | "caption">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedCaption, setSelectedCaption] = useState("bold-overlay");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userPlan, setUserPlan] = useState("free");
  const [userCredits, setUserCredits] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("plan, credits").eq("id", user.id).single();
      setUserPlan(profile?.plan ?? "free");
      setUserCredits(profile?.credits ?? 0);
      const { data: tmpl } = await supabase.from("templates").select("*").eq("active", true).order("sort_order");
      setTemplates(tmpl ?? []);
    }
    load();
  }, []);

  function canUseTemplate(templatePlan: string) {
    return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(templatePlan);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  }

  function handleUploadNext(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title) return;
    setStep("template");
  }

  async function handleSubmit() {
    if (!file || !selectedTemplate) return;
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(filePath);

      const { data: video, error: dbError } = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          title,
          artist,
          cap_style: selectedCaption,
          clip_style: selectedTemplate.background_type,
          template: selectedTemplate.id,
          status: "pending",
        })
        .select()
        .single();
      if (dbError) throw dbError;

      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId: video.id,
          fileUrl: urlData.publicUrl,
          title,
          artist,
          captionStyle: selectedCaption,
          templateId: selectedTemplate.id,
          userId: user.id,
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "Not enough credits. Top up to continue.") {
          throw new Error(`Not enough credits. You need ${data.required} credits but only have ${data.credits}. Go to Settings to top up.`);
        }
        throw new Error("You've reached your limit. Upgrade your plan to continue.");
      }

      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  const steps = ["upload", "template", "caption"];
  const stepIndex = steps.indexOf(step);

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
        input::placeholder { color: rgba(245,240,235,0.2); }
        input:focus { border-color: rgba(200,16,46,0.4) !important; outline: none; }
      `}</style>

      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "60vh", background: "radial-gradient(ellipse at center, rgba(139,0,20,0.1) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "160px", pointerEvents: "none", zIndex: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: "3px", padding: "0 2rem", opacity: 0.08 }}>
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} style={{ flex: 1, background: "#c8102e", borderRadius: "2px 2px 0 0", animation: `wave${i % 8} ${1.5 + (i % 5) * 0.3}s ease-in-out infinite alternate`, animationDelay: `${(i % 7) * 0.15}s` }} />
        ))}
      </div>

      <nav style={{ borderBottom: "1px solid rgba(200,16,46,0.12)", padding: "1.25rem 3rem", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(13,3,5,0.75)", backdropFilter: "blur(16px)", position: "sticky", top: 0, zIndex: 50 }}>
        <span style={{ fontSize: "1.4rem", fontWeight: "700", letterSpacing: "0.12em", color: "#c8102e", textTransform: "uppercase" }}>W∆LVR</span>
        <button onClick={() => router.push("/dashboard")} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(245,240,235,0.45)", padding: "0.6rem 1.5rem", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>← Back</button>
      </nav>

      <div style={{ padding: "4rem 3rem", maxWidth: "860px", margin: "0 auto", position: "relative", zIndex: 10 }}>

        <div style={{ marginBottom: "3rem" }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#c8102e", marginBottom: "0.75rem" }}>Step {stepIndex + 1} of 3</p>
          <h1 style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: "700", color: "#f5f0eb", letterSpacing: "-0.02em", lineHeight: "1.1" }}>
            {step === "upload" && "Upload Your Song"}
            {step === "template" && "Pick a Template"}
            {step === "caption" && "Choose Caption Style"}
          </h1>
          <p style={{ color: "rgba(245,240,235,0.35)", marginTop: "0.75rem", fontSize: "0.9rem" }}>
            {step === "upload" && "Drop your track and tell us the song details."}
            {step === "template" && "Each template is a proven viral format. Pick the one that fits your song."}
            {step === "caption" && "Pick how your lyrics appear on screen."}
          </p>
        </div>
        <p style={{ fontSize: "0.75rem", color: "rgba(245,240,235,0.3)", textAlign: "right" }}>
                  Your balance: <span style={{ color: "#f5f0eb" }}>{userCredits} credits</span>
                </p>
        <div style={{ display: "flex", gap: "6px", marginBottom: "3rem" }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1, height: "2px", background: i <= stepIndex ? "#c8102e" : "rgba(255,255,255,0.08)", transition: "background 0.3s" }} />
          ))}
        </div>

        {/* Step 1 — Upload */}
        {step === "upload" && (
          <form onSubmit={handleUploadNext} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <label style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.4)", display: "block", marginBottom: "0.75rem" }}>Song File</label>
              <div style={{ border: `2px dashed ${file ? "#c8102e" : "rgba(200,16,46,0.2)"}`, borderRadius: "4px", padding: "3rem 2rem", textAlign: "center", background: "rgba(13,3,5,0.4)", backdropFilter: "blur(8px)", cursor: "pointer", transition: "all 0.2s" }}>
                <input type="file" accept=".mp3,.mp4,.wav,.m4a" onChange={handleFileChange} id="file-input" style={{ display: "none" }} />
                <label htmlFor="file-input" style={{ cursor: "pointer", display: "block" }}>
                  {file ? (
                    <p style={{ color: "#c8102e", fontSize: "0.9rem" }}>{file.name}</p>
                  ) : (
                    <>
                      <p style={{ color: "rgba(245,240,235,0.4)", marginBottom: "0.5rem", fontSize: "0.9rem" }}>Drop your MP3 or MP4 here</p>
                      <p style={{ color: "rgba(245,240,235,0.2)", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase" }}>or click to browse</p>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.4)", display: "block", marginBottom: "0.75rem" }}>Song Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Lose Yourself" style={{ width: "100%", padding: "1rem 1.25rem", background: "rgba(13,3,5,0.5)", border: "1px solid rgba(200,16,46,0.15)", color: "#f5f0eb", fontSize: "1rem", fontFamily: "'Georgia', serif", outline: "none", boxSizing: "border-box" }} />
            </div>

            <div>
              <label style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.4)", display: "block", marginBottom: "0.75rem" }}>Artist Name</label>
              <input type="text" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="e.g. Eminem" style={{ width: "100%", padding: "1rem 1.25rem", background: "rgba(13,3,5,0.5)", border: "1px solid rgba(200,16,46,0.15)", color: "#f5f0eb", fontSize: "1rem", fontFamily: "'Georgia', serif", outline: "none", boxSizing: "border-box" }} />
            </div>

            <button type="submit" style={{ padding: "1rem", background: "#8b0014", color: "#f5f0eb", border: "1px solid rgba(200,16,46,0.6)", fontSize: "0.8rem", letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer", marginTop: "0.5rem", fontFamily: "'Georgia', serif" }}>
              Next — Pick Template →
            </button>
          </form>
        )}

        {/* Step 2 — Template */}
        {step === "template" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1px", background: "rgba(200,16,46,0.08)", border: "1px solid rgba(200,16,46,0.08)" }}>
              {templates.map((tmpl) => {
                const unlocked = canUseTemplate(tmpl.plan_required);
                const isSelected = selectedTemplate?.id === tmpl.id;
                const colors = tmpl.color_scheme?.colors ?? ["#111"];

                return (
                  <button
                    key={tmpl.id}
                    onClick={() => unlocked && setSelectedTemplate(tmpl)}
                    style={{
                      padding: "0",
                      background: isSelected ? "rgba(139,0,20,0.25)" : "rgba(13,3,5,0.5)",
                      border: "none",
                      borderLeft: isSelected ? "2px solid #c8102e" : "2px solid transparent",
                      textAlign: "left",
                      cursor: unlocked ? "pointer" : "not-allowed",
                      transition: "all 0.2s",
                      overflow: "hidden",
                      opacity: unlocked ? 1 : 0.4,
                      position: "relative",
                    }}
                    onMouseEnter={(e) => { if (unlocked && !isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(139,0,20,0.1)"; }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(13,3,5,0.5)"; }}
                  >
                    {/* Preview */}
                    <div style={{
                      width: "100%",
                      height: "110px",
                      background: colors.length > 1
                        ? `linear-gradient(135deg, ${colors.join(", ")})`
                        : colors[0],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      overflow: "hidden",
                    }}>
                      <span style={{
                        fontSize: "18px",
                        fontWeight: "800",
                        color: tmpl.color_scheme?.text ?? "#ffffff",
                        letterSpacing: "0.05em",
                        textShadow: tmpl.caption_style === "frosted" ? "0 0 15px white" : "none",
                        WebkitTextStroke: tmpl.caption_style === "karaoke" ? "0.5px white" : "none",
                      }}>SAMPLE</span>

                      {!unlocked && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "#c8102e", border: "1px solid rgba(200,16,46,0.4)", padding: "0.25rem 0.75rem" }}>
                            {tmpl.plan_required.toUpperCase()} PLAN
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: "1rem 1.25rem" }}>
                      <p style={{ fontSize: "0.9rem", fontWeight: "600", color: isSelected ? "#f5f0eb" : "rgba(245,240,235,0.7)", marginBottom: "0.3rem" }}>{tmpl.name}</p>
                      <p style={{ fontSize: "0.72rem", color: "rgba(245,240,235,0.3)", lineHeight: "1.4" }}>{tmpl.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={() => setStep("upload")} style={{ flex: 1, padding: "1rem", background: "transparent", color: "rgba(245,240,235,0.4)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.8rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif" }}>← Back</button>
              <button onClick={() => selectedTemplate && setStep("caption")} disabled={!selectedTemplate} style={{ flex: 2, padding: "1rem", background: selectedTemplate ? "#8b0014" : "rgba(139,0,20,0.2)", color: selectedTemplate ? "#f5f0eb" : "rgba(245,240,235,0.2)", border: `1px solid ${selectedTemplate ? "rgba(200,16,46,0.6)" : "rgba(200,16,46,0.1)"}`, fontSize: "0.8rem", letterSpacing: "0.2em", textTransform: "uppercase", cursor: selectedTemplate ? "pointer" : "not-allowed", fontFamily: "'Georgia', serif" }}>
                Next — Caption Style →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Caption */}
        {step === "caption" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
            <p style={{ fontSize: "0.75rem", color: "rgba(245,240,235,0.3)", textAlign: "right" }}>
              Your balance: <span style={{ color: "#f5f0eb" }}>{userCredits} credits</span>
            </p>
            {/* rest of caption step */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1px", background: "rgba(200,16,46,0.08)", border: "1px solid rgba(200,16,46,0.08)" }}>
              {CAPTION_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => setSelectedCaption(style.id)}
                  style={{
                    padding: "0",
                    background: selectedCaption === style.id ? "rgba(139,0,20,0.2)" : "rgba(13,3,5,0.5)",
                    border: "none",
                    borderLeft: selectedCaption === style.id ? "2px solid #c8102e" : "2px solid transparent",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => { if (selectedCaption !== style.id) (e.currentTarget as HTMLElement).style.background = "rgba(139,0,20,0.1)"; }}
                  onMouseLeave={(e) => { if (selectedCaption !== style.id) (e.currentTarget as HTMLElement).style.background = "rgba(13,3,5,0.5)"; }}
                >
                  <div style={{ width: "100%", height: "90px", background: "#000", display: "flex", alignItems: style.preview.bottom ? "flex-end" : "center", justifyContent: "center", padding: style.preview.bottom ? "0 0 10px 0" : "0" }}>
                    <span style={{
                      fontSize: style.preview.bottom ? "13px" : "20px",
                      fontWeight: style.preview.bottom ? "400" : "800",
                      color: style.preview.yellow ? "#ffdd00" : "rgba(255,255,255,0.9)",
                      textShadow: style.preview.glow ? "0 0 15px white, 0 0 30px rgba(255,255,255,0.5)" : "none",
                      background: style.preview.highlight ? "rgba(255,255,255,0.12)" : "transparent",
                      padding: style.preview.highlight ? "3px 8px" : "0",
                      WebkitTextStroke: style.preview.yellow ? "0.5px white" : "none",
                    }}>{style.preview.text}</span>
                  </div>
                  <div style={{ padding: "0.9rem 1.1rem" }}>
                    <p style={{ fontSize: "0.85rem", fontWeight: "600", color: selectedCaption === style.id ? "#f5f0eb" : "rgba(245,240,235,0.7)", marginBottom: "0.2rem" }}>{style.label}</p>
                    <p style={{ fontSize: "0.7rem", color: "rgba(245,240,235,0.3)" }}>{style.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {error && <p style={{ color: "#c8102e", fontSize: "0.85rem" }}>{error}</p>}

            <div style={{ display: "flex", gap: "1rem" }}>
              <button onClick={() => setStep("template")} style={{ flex: 1, padding: "1rem", background: "transparent", color: "rgba(245,240,235,0.4)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.8rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif" }}>← Back</button>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "rgba(139,0,20,0.1)", border: "1px solid rgba(200,16,46,0.2)" }}>
                  <span style={{ fontSize: "0.7rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,235,0.4)" }}>Credit Cost</span>
                  <span style={{ fontSize: "1rem", fontWeight: "700", color: "#c8102e" }}>
                    {selectedTemplate?.background_type === "color-block" || selectedTemplate?.background_type === "dark-solid"
                      ? "100 credits"
                      : "200 credits"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <button onClick={() => setStep("template")} style={{ flex: 1, padding: "1rem", background: "transparent", color: "rgba(245,240,235,0.4)", border: "1px solid rgba(255,255,255,0.08)", fontSize: "0.8rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif" }}>← Back</button>
                  <button onClick={handleSubmit} disabled={loading} style={{ flex: 2, padding: "1rem", background: "#8b0014", color: "#f5f0eb", border: "1px solid rgba(200,16,46,0.6)", fontSize: "0.8rem", letterSpacing: "0.2em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1, fontFamily: "'Georgia', serif" }}>
                    {loading ? "Creating..." : "Create Video →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
