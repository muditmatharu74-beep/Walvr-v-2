import { useCurrentFrame, useVideoConfig, Audio, AbsoluteFill } from "remotion";

type Caption = {
  word: string;
  start: number;
  end: number;
};

export type DarkLyricsProps = {
  captions: Caption[];
  songDuration: number;
  beats: number[];
  audioUrl?: string;
  plan?: string;
  captionStyle?: string;
};

export const DarkLyrics: React.FC<DarkLyricsProps> = ({ captions, beats, audioUrl, plan = "free", captionStyle = "bold-overlay" }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const scale = width / 1080;
  const minimal = captionStyle === "minimal";
  const currentTime = frame / fps;

  const currentWord = captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end + 0.1
  );

  const prevWord = captions.find(
    (c) => currentTime > c.end + 0.1 && 
    captions.indexOf(c) === captions.findIndex(cap => currentTime >= cap.start && currentTime <= cap.end + 0.1) - 1
  );

  const isOnBeat = beats.some(
    (beat) => Math.abs(currentTime - beat) < 0.05
  );

  const bgBrightness = isOnBeat ? 18 : 8;

  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${bgBrightness}, ${bgBrightness}, ${bgBrightness})` }}>
      
      {/* Wine red vignette */}
      <AbsoluteFill style={{
        background: "radial-gradient(ellipse at center, transparent 35%, rgba(80,0,15,0.6) 100%)",
      }} />

      {/* Previous word — faded */}
      {prevWord && !minimal && (
        <AbsoluteFill style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.15,
          transform: `translateY(${-100 * scale}px)`,
        }}>
          <p style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 900,
            fontSize: 90 * scale,
            color: "white",
            textAlign: "center",
            padding: "0 60px",
            margin: 0,
            lineHeight: 1.1,
          }}>
            {prevWord.word.toUpperCase()}
          </p>
        </AbsoluteFill>
      )}

      {/* Current word — full brightness with scale slam */}
      {currentWord && (
        <AbsoluteFill style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: minimal ? "translateY(35%)" : undefined,
        }}>
          <p style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: minimal ? 400 : 900,
            fontSize: (minimal ? 70 : 160) * scale,
            color: captionStyle === "karaoke" ? "#ffdd00" : "white",
            textAlign: "center",
            maxWidth: "90%",
            overflowWrap: "anywhere",
            padding: "0 40px",
            background: captionStyle === "word-highlight" ? "rgba(255,255,255,0.15)" : undefined,
            borderRadius: captionStyle === "word-highlight" ? 12 * scale : undefined,
            margin: 0,
            lineHeight: 1.05,
            textShadow: "0 0 40px rgba(255,255,255,0.3), 0 0 80px rgba(255,255,255,0.1)",
            transform: `scale(${isOnBeat ? 1.05 : 1})`,

          }}>
            {currentWord.word.toUpperCase()}
          </p>
        </AbsoluteFill>
      )}

      {plan === "free" && <div style={{ position: "absolute", bottom: "4%", width: "100%", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 40 * scale }}>Made with Walvr</div>}
      {/* Audio */}
      {audioUrl && <Audio src={audioUrl} />}

    </AbsoluteFill>
  );
};
