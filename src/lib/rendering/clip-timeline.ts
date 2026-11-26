export type ClipRange = { startMs: number; endMs: number };
type Word = { start: number; end: number };

export function clipTimelines<T extends Word>(
  source: { songDuration: number; captions: readonly T[]; beats: readonly number[] },
  ranges: readonly ClipRange[],
) {
  if (!Number.isFinite(source.songDuration) || source.songDuration <= 0 ||
      ranges.length < 1 || ranges.length > 3) {
    throw new RangeError("Choose one to three clips from a valid source.");
  }
  const seen = new Set<string>();
  return ranges.map(({ startMs, endMs }) => {
    const length = endMs - startMs;
    const key = `${startMs}:${endMs}`;
    if (!Number.isSafeInteger(startMs) || !Number.isSafeInteger(endMs) ||
        startMs < 0 || endMs > Math.floor(source.songDuration * 1000) ||
        length < 20_000 || length > 35_000 || seen.has(key)) {
      throw new RangeError("Choose distinct 20–35 second clips within the song.");
    }
    seen.add(key);
    const start = startMs / 1000, end = endMs / 1000;
    return {
      startMs, endMs, songDuration: length / 1000,
      captions: source.captions.filter(w => Number.isFinite(w.start) && Number.isFinite(w.end) &&
        w.end > w.start && w.end > start && w.start < end).map(w => ({
          ...w, start: Math.max(w.start, start) - start, end: Math.min(w.end, end) - start,
        })),
      beats: source.beats.filter(b => b >= start && b < end).map(b => b - start),
    };
  });
}
