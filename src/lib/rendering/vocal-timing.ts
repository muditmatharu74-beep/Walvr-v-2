/** Trusted worker/offline result adapter. Never accept this result from a browser.
 * The caller must hash the owned original upload and independently measure it.
 * Separation changes the analysis input; the render still uses the original.
 */
export type VocalTiming = {
  schemaVersion: number;
  sourceSha256: string;
  songDuration: number;
  excerptStart: number;
  excerptDuration: number;
  text: string;
  words: Array<{word: string; start: number; end: number; alignmentScore: number | null}>;
  beats: number[];
  reviewRequired: boolean;
};

export function vocalTimingForRender(
  input: unknown, original: {sha256: string; duration: number},
  options: {reviewOnly?: boolean} = {},
): {text: string; words: VocalTiming["words"]; beats: number[]; duration: number; needsReview: boolean} {
  const result = input as VocalTiming;
  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  if (!result || result.schemaVersion !== 1 ||
      !/^[a-f0-9]{64}$/.test(original.sha256) || result.sourceSha256 !== original.sha256 ||
      !finite(original.duration) || original.duration <= 0 ||
      !finite(result.songDuration) || Math.abs(result.songDuration - original.duration) > 0.05) {
    throw new Error("Vocal analysis does not match the original upload");
  }
  if (!finite(result.excerptStart) || result.excerptStart < 0 ||
      !finite(result.excerptDuration) || result.excerptDuration <= 0 ||
      result.excerptStart + result.excerptDuration > original.duration + 0.05) {
    throw new Error("Vocal analysis has an invalid source interval");
  }
  if (!options.reviewOnly && (result.excerptStart !== 0 ||
      Math.abs(result.excerptDuration - original.duration) > 0.05)) {
    throw new Error("A partial analysis cannot caption a complete song");
  }
  if (typeof result.reviewRequired !== "boolean" || typeof result.text !== "string" ||
      !Array.isArray(result.words) || result.words.length === 0 || !Array.isArray(result.beats)) {
    throw new Error("Vocal analysis has no usable lyric timings");
  }
  let previous = -1;
  for (const word of result.words) {
    if (!word || typeof word.word !== "string" || !word.word.trim() ||
        !finite(word.start) || !finite(word.end) || word.start < result.excerptStart ||
        word.start < previous || word.end <= word.start ||
        word.end > Math.min(original.duration, result.excerptStart + result.excerptDuration) + 0.001 ||
        !(word.alignmentScore === null || (finite(word.alignmentScore) && word.alignmentScore >= 0 && word.alignmentScore <= 1))) {
      throw new Error("Vocal analysis contains unaligned or invalid lyric timings");
    }
    previous = word.start;
  }
  previous = -1;
  for (const beat of result.beats) {
    if (!finite(beat) || beat < result.excerptStart || beat <= previous ||
        beat >= Math.min(original.duration, result.excerptStart + result.excerptDuration)) {
      throw new Error("Vocal analysis contains invalid beat timings");
    }
    previous = beat;
  }
  if (result.reviewRequired && !options.reviewOnly) {
    throw new Error("Vocal analysis requires review before a final render");
  }
  // Do not add excerptStart again: word/beat timestamps are already absolute.
  // Copy to prevent layout normalization from mutating the saved worker result.
  return {text: result.text, words: result.words.map(word => ({...word})),
    beats: [...result.beats], duration: original.duration, needsReview: result.reviewRequired};
}
