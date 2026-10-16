import { NeonCaptionPreview } from "../../components/NeonCaptionPreview";

export default function CaptionPreviewPage() {
  return <main style={{ background: "#070d15", color: "#f5fbff", minHeight: "100vh", padding: "32px 20px", fontFamily: "system-ui,sans-serif" }}>
    <div style={{ maxWidth: 760, margin: "auto" }}>
      <p style={{ color: "#63edff", letterSpacing: "0.15em" }}>W∆LVR / CAPTIONS</p>
      <h1 style={{ fontSize: 32, fontWeight: 650, lineHeight: 1.15, margin: "12px 0" }}>Two ways to light up the lyrics.</h1>
      <p style={{ color: "#a8bdce", marginBottom: 24 }}>Same words and timing. Choose smooth lettering or a retro game feel.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 24 }}>
        {(["clean-neon", "pixel-neon"] as const).map(style => <section key={style}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>{style === "clean-neon" ? "Clean Neon" : "Pixel Neon"}</h2>
          <NeonCaptionPreview style={style} large />
        </section>)}
      </div>
      <p style={{ color: "#9db2c6", marginTop: 20 }}>Caption demo with a synthetic background. Final song and footage comparison still to come.</p>
    </div>
  </main>;
}
