import { useMemo } from "react";
import { layoutNeonCaptions, neonDesign, type NeonStyle, type WordTiming } from "../lib/rendering/neon-captions";

export function NeonCaptionOverlay({ captions, style, time }: { captions: WordTiming[]; style: NeonStyle; time: number }) {
  const phrases = useMemo(() => layoutNeonCaptions(captions, style), [captions, style]);
  const phrase = phrases.find(p => time >= p.start && time < p.end);
  const design = neonDesign(style);
  return <div style={{ position: "absolute", inset: 0, containerType: "inline-size", pointerEvents: "none" }}>
    {phrase?.words.map((word, index) => {
      const activeEnd = Math.min(word.end, phrase.words[index + 1]?.start ?? phrase.end);
      const active = time >= word.start && time < activeEnd;
      return <span key={index} data-active={active} style={{
        position: "absolute", left: `${word.x / 10.8}%`, top: `${word.y / 19.2}%`,
        width: `${word.width / 10.8}%`, transform: "translate(-50%, -50%)",
        fontFamily: `"${design.family}", sans-serif`, fontWeight: design.weight,
        fontSize: `${word.fontSize / 10.8}cqw`, lineHeight: 1.4, textAlign: "center", whiteSpace: "nowrap",
        color: active ? design.activeColor : design.color,
        textShadow: `0 2px 2px #05101a, 0 0 ${design.glow / 10.8}cqw #128dff`,
      }}>{word.text}</span>;
    })}
  </div>;
}
