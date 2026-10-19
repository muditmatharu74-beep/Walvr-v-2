import { useCurrentFrame, useVideoConfig, Audio, AbsoluteFill, Loop, OffthreadVideo } from "remotion";
import type { NeonBackground } from "../lib/rendering/neon-background";

import { captionOpacity, isNeonStyle } from "../lib/rendering/neon-captions";
import { NeonCaptionOverlay } from "../components/NeonCaptionOverlay";
import { useEffect, useMemo, useState } from "react";
import { delayRender, continueRender, cancelRender } from "remotion";
import "@fontsource/montserrat/latin-900.css";
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
  backgroundVideo?: NeonBackground;
};

export const DarkLyrics: React.FC<DarkLyricsProps> = ({ captions, beats, audioUrl, captionStyle, backgroundVideo }) => {
  const neon = isNeonStyle(captionStyle);
  const [fontHandle] = useState(() => neon ? delayRender("Load neon caption font") : null);
  useEffect(() => {
    if (fontHandle === null) return;
    const font = captionStyle === "pixel-neon" ? '400 60px "Press Start 2P"' : '900 84px "Montserrat"';
    document.fonts.load(font).then(loaded => {
      if (!loaded.length) throw new Error("Neon caption font failed to load");
      continueRender(fontHandle);
    }).catch(cancelRender);
  }, [captionStyle, fontHandle]);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  const basicCaptions = useMemo(() => neon ? [] : captions.filter(c =>
    c && typeof c.word === "string" && c.word.trim() &&
    Number.isFinite(c.start) && Number.isFinite(c.end) && c.start >= 0 && c.end > c.start
  ).sort((a, b) => a.start - b.start), [captions, neon]);
  const currentWordIndex = basicCaptions.findIndex((c, index) =>
    currentTime >= c.start && currentTime < Math.min(c.end + 0.1, basicCaptions[index + 1]?.start ?? Infinity)
  );
  const currentWord = basicCaptions[currentWordIndex];
  const currentWordEnd = currentWord
    ? Math.min(currentWord.end + 0.1, basicCaptions[currentWordIndex + 1]?.start ?? Infinity) : 0;
  const previous = basicCaptions[currentWordIndex - 1];
  const prevWord = previous && currentTime > previous.end + 0.1 ? previous : undefined;

  const isOnBeat = beats.some(
    (beat) => Math.abs(currentTime - beat) < 0.05
  );

  const bgBrightness = isOnBeat ? 18 : 8;

  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${bgBrightness}, ${bgBrightness}, ${bgBrightness})` }}>
      {backgroundVideo && (
        <>
          <Loop durationInFrames={Math.max(1, Math.ceil(backgroundVideo.duration * fps))}>
            <OffthreadVideo src={backgroundVideo.src} muted style={{width: "100%", height: "100%", objectFit: "cover"}} />
          </Loop>
          <AbsoluteFill style={{backgroundColor: "rgba(0,0,0,0.25)"}} />
        </>
      )}
      
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
          opacity: captionOpacity(currentTime, currentWord.start, currentWordEnd),
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
