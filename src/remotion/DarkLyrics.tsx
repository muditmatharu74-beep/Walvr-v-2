import { useCurrentFrame, useVideoConfig, Audio, AbsoluteFill } from "remotion";

type Caption = {
  word: string;
  start: number;
  end: number;
};

type Props = {
  captions: Caption[];
  songDuration: number;
  beats: number[];
  audioUrl?: string;
};

export const DarkLyrics: React.FC<Props> = ({ captions, beats, audioUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
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
      {prevWord && (
        <AbsoluteFill style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.15,
          transform: "translateY(-80px)",
        }}>
          <p style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 900,
            fontSize: 90,
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
        }}>
          <p style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 900,
            fontSize: 160,
            color: "white",
            textAlign: "center",
            padding: "0 40px",
            margin: 0,
            lineHeight: 1.05,
            textShadow: "0 0 40px rgba(255,255,255,0.3), 0 0 80px rgba(255,255,255,0.1)",
            transform: `scale(${isOnBeat ? 1.05 : 1})`,
            transition: "transform 0.05s ease",
          }}>
            {currentWord.word.toUpperCase()}
          </p>
        </AbsoluteFill>
      )}

      {/* Audio */}
      {audioUrl && <Audio src={audioUrl} />}

    </AbsoluteFill>
  );
};
