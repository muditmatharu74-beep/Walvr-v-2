export const CAPTION_STYLE_IDS = ["bold-overlay", "word-highlight", "frosted", "minimal", "karaoke", "clean-neon", "pixel-neon"] as const;
export type CaptionStyle = typeof CAPTION_STYLE_IDS[number];
export type WordTiming = { word: string; start: number; end: number };
export type NeonStyle = "clean-neon" | "pixel-neon";
export const isNeonStyle = (style?: string): style is NeonStyle => style === "clean-neon" || style === "pixel-neon";

export function creditCost(plan: string, backgroundType?: string, style?: string) {
  if (plan === "business" || plan === "studio") return 350;
  const basicBackground = backgroundType === "color-block" || backgroundType === "dark-solid";
  return basicBackground && (style === "bold-overlay" || style === "minimal") ? 100 : 200;
}

export function neonDesign(style: NeonStyle) {
  const pixel = style === "pixel-neon";
  return {
    family: pixel ? "Press Start 2P" : "Montserrat", weight: pixel ? 400 : 800,
    fontSize: pixel ? 48 : 64, characterWidth: pixel ? 1.1 : 0.85,
    glow: pixel ? 5 : 12, color: "#f5fbff", activeColor: "#63edff",
    fontUrl: pixel
      ? "https://cdn.jsdelivr.net/npm/@fontsource/press-start-2p@5.3.0/files/press-start-2p-latin-400-normal.woff"
      : "https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.3.0/files/montserrat-latin-800-normal.woff",
  };
}

// One deterministic layout feeds browser/Remotion previews and Creatomate.
// Coordinates are in a 1080 x 1920 design space, safely above social UI.
export function layoutNeonCaptions(captions: WordTiming[], style: NeonStyle) {
  const design = neonDesign(style);
  const sorted = captions.filter(w => w && typeof w.word === "string" && w.word.trim() && Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end > w.start)
    .map(w => ({ ...w, word: w.word.trim().replace(/\s+/g, " ") })).sort((a, b) => a.start - b.start);
  const valid: WordTiming[] = [];
  for (const word of sorted) {
    const previous = valid[valid.length - 1];
    if (previous && /^[.,!?;:…'"’”\)\]\}]+$/.test(word.word)) {
      // Transcribers sometimes emit closing punctuation as a separate token.
      previous.word += word.word;
    } else if (previous && previous.start === word.start) {
      // A shared timestamp cannot identify an individual active word. Display
      // and highlight the tied words together instead of dropping a phrase.
      previous.word += " " + word.word;
      previous.end = Math.max(previous.end, word.end);
    } else {
      valid.push(word);
    }
  }
  const displayText = (word: WordTiming) => style === "pixel-neon" ? word.word.toUpperCase() : word.word;
  // Reserve extra room for wide capitals and rounding at phone-size scales
  // without spreading ordinary short words across oversized slots.
  const textUnits = (text: string) => Array.from(text).reduce((sum, character) => sum +
    (style === "pixel-neon" ? design.characterWidth : /[WM]/.test(character) ? 1.3 :
      /[wm]/.test(character) ? 1.1 : /[A-Z]/.test(character) ? 0.95 : design.characterWidth), 0);
  const phrases: WordTiming[][] = [];
  let group: WordTiming[] = [];
  for (const word of valid) {
    const previous = group[group.length - 1];
    if (group.length && (group.length >= 4 || Array.from([...group, word].map(displayText).join(" ")).length > 28 ||
      word.start - Math.max(...group.map(w => w.end)) > 0.6 || /[.!?…]["'’”\)\]\}]*$/.test(previous.word))) {
      phrases.push(group); group = [];
    }
    group.push(word);
  }
  if (group.length) phrases.push(group);
  return phrases.map((words, phraseIndex) => {
    const start = words[0].start;
    const nextStart = phrases[phraseIndex + 1]?.[0].start ?? Infinity;
    const end = Math.min(Math.max(...words.map(w => w.end)) + 0.1, nextStart);
    const slots = words.map(word => {
      const text = displayText(word);
      const units = textUnits(text);
      const width = Math.min(864, Math.max(48, units * design.fontSize + 12));
      return { ...word, text, width, units };
    });
    const lines: typeof slots[] = [[]];
    for (const slot of slots) {
      const line = lines[lines.length - 1];
      if (line.length && line.reduce((sum, w) => sum + w.width + 16, -16) + 16 + slot.width > 864) lines.push([]);
      lines[lines.length - 1].push(slot);
    }
    const positioned = lines.flatMap((line, lineIndex) => {
      const lineWidth = line.reduce((sum, w) => sum + w.width + 16, -16);
      let left = (1080 - lineWidth) / 2;
      return line.map(slot => {
        const x = left + slot.width / 2; left += slot.width + 16;
        return { ...slot, x, y: 1320 + (lineIndex - (lines.length - 1) / 2) * 100,
          fontSize: Math.min(design.fontSize, (slot.width - 12) / slot.units) };
      });
    });
    return { start, end, words: positioned };
  });
}

export function neonTextElements(captions: WordTiming[], style: NeonStyle) {
  const design = neonDesign(style);
  return layoutNeonCaptions(captions, style).flatMap((phrase, p) => phrase.words.flatMap((word, w) => {
    const base = {
      type: "text", track: 2, x: `${word.x / 10.8}%`, y: `${word.y / 19.2}%`,
      x_anchor: "50%", y_anchor: "50%", width: `${word.width / 10.8}%`, height: "5%",
      text: word.text, x_alignment: "50%", y_alignment: "50%", text_wrap: false,
      font_family: design.family, font_weight: design.weight,
      font_size: `${word.fontSize / 10.8} vmin`,
      stroke_color: "#05101a", stroke_width: "0.2 vmin",
      shadow_color: "#128dff", shadow_blur: `${design.glow / 10.8} vmin`, shadow_x: 0, shadow_y: 0,
    };
    const activeEnd = Math.min(word.end, phrase.words[w + 1]?.start ?? phrase.end, phrase.end);
    return [
      { ...base, name: `neon-${p}-${w}`, time: phrase.start, duration: phrase.end - phrase.start, fill_color: design.color },
      ...(activeEnd > word.start ? [{ ...base, track: 3, name: `neon-active-${p}-${w}`, time: word.start,
        duration: activeEnd - word.start, fill_color: design.activeColor }] : []),
    ];
  }));
}
