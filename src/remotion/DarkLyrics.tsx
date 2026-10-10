import { useCurrentFrame, useVideoConfig, Audio, AbsoluteFill } from "remotion";

import { isNeonStyle } from "../lib/rendering/neon-captions";
import { NeonCaptionOverlay } from "../components/NeonCaptionOverlay";
import { useEffect, useState } from "react";
import { delayRender, continueRender, cancelRender } from "remotion";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/press-start-2p/latin-400.css";

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
  captionStyle?: string;
};

export const DarkLyrics: React.FC<DarkLyricsProps> = ({ captions, beats, audioUrl, captionStyle }) => {
  const neon = isNeonStyle(captionStyle);
  const [fontHandle] = useState(() => neon ? delayRender("Load neon caption font") : null);
  useEffect(() => {
    if (fontHandle === null) return;
    const font = captionStyle === "pixel-neon" ? '400 48px "Press Start 2P"' : '800 64px "Montserrat"';
    document.fonts.load(font).then(loaded => {
      if (!loaded.length) throw new Error("Neon caption font failed to load");
      continueRender(fontHandle);
    }).catch(cancelRender);
  }, [captionStyle, fontHandle]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const currentWord = neon ? undefined : captions.find(
    (c) => currentTime >= c.start && currentTime <= c.end + 0.1
  );

  const prevWord = neon ? undefined : captions.find(
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
      {!neon && prevWord && (
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
      {!neon && currentWord && (
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

      {neon && <NeonCaptionOverlay captions={captions} style={captionStyle} time={currentTime} />}

      {/* Audio */}
      {audioUrl && <Audio src={audioUrl} />}

    </AbsoluteFill>
  );
};
