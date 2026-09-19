export const VIDEO_FPS = 30;

export function durationInFrames(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("Song duration must be a positive, finite number");
  }
  return Math.max(1, Math.ceil(seconds * VIDEO_FPS));
}

export function songDuration(duration: unknown, words: Array<{ end: number }>): number {
  // Whisper's media duration preserves instrumental intros and outros.
  if (typeof duration === "number" && Number.isFinite(duration) && duration > 0) return duration;
  const lastEnd = Math.max(0, ...words.map((word) => word.end));
  if (Number.isFinite(lastEnd) && lastEnd > 0) return lastEnd + 1;
  throw new Error("Could not determine the song duration");
}
