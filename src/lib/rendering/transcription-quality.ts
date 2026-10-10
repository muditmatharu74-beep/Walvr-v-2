export class TranscriptionQualityError extends Error {}
const LETTER = new RegExp("\\p{L}", "u");
const LATIN = new RegExp("\\p{Script=Latin}", "u");

// Music markers and symbol-only hallucinations are not lyric words. Keep
// genuine punctuation and timing data intact; never invent replacement lyrics.
export function assertUsableTranscription(transcription: {words?: unknown}, neon: boolean): void {
  if (!Array.isArray(transcription.words)) {
    throw new TranscriptionQualityError("The transcription did not include lyric timings. Please try an audio file with clear vocals.");
  }
  // An explicitly empty transcript can represent an instrumental composition.
  if (transcription.words.length === 0) return;
  const words = transcription.words.filter(w => w && typeof w.word === "string" &&
    Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end > w.start);
  const lyrical = words.filter(w => LETTER.test(w.word));
  if (words.length === 0 || lyrical.length === 0 || lyrical.length / words.length < 0.5) {
    throw new TranscriptionQualityError("We couldn't detect reliable lyrics in this audio. Please use a version with clear vocals.");
  }
  if (neon && lyrical.some(w => Array.from(w.word as string).some(char => LETTER.test(char) && !LATIN.test(char)))) {
    throw new TranscriptionQualityError("These neon fonts currently support Latin-script lyrics. Choose another caption style or an audio version with Latin-script vocals.");
  }
}
