"use client";

import { useEffect, useState } from "react";
import { NeonCaptionOverlay } from "./NeonCaptionOverlay";
import type { NeonStyle } from "../lib/rendering/neon-captions";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/press-start-2p/latin-400.css";

const SAMPLE = [
  { word: "Late", start: 0, end: 0.8 },
  { word: "night", start: 0.8, end: 1.6 },
  { word: "ride", start: 1.6, end: 2.4 },
  { word: "home", start: 2.4, end: 3.2 },
];

export function NeonCaptionPreview({ style, large = false }: { style: NeonStyle; large?: boolean }) {
  const [time, setTime] = useState(0.4);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    function update() {
      if (timer) clearInterval(timer);
      if (preference.matches) setTime(0.4);
      else timer = setInterval(() => setTime(t => (t + 0.1) % 3.2), 100);
    }
    update(); preference.addEventListener("change", update);
    return () => { if (timer) clearInterval(timer); preference.removeEventListener("change", update); };
  }, []);
  return <div aria-hidden="true" style={{ position: "relative", containerType: "inline-size", width: "100%", aspectRatio: large ? "9 / 16" : undefined,
    height: large ? undefined : 150, overflow: "hidden", background: "linear-gradient(150deg,#061321,#071019 55%,#142047)" }}>
    <div style={{ position: "absolute", inset: "12% 16%", borderLeft: "2px solid #128dff", borderRight: "2px solid #3852b9", opacity: 0.5 }} />
    <div style={{ position: "absolute", width: "100%", aspectRatio: "9 / 16", top: large ? 0 : "calc(50% - 122.22cqw)" }}>
      <NeonCaptionOverlay captions={SAMPLE} style={style} time={time} />
    </div>
  </div>;
}
