import { clipTimelines, type ClipRange } from "./clip-timeline";
import { MAX_UPLOAD_BYTES } from "./upload";

export function encodeClipWav(buffer: AudioBuffer, range: ClipRange): ArrayBuffer {
  clipTimelines({ songDuration: buffer.duration, captions: [], beats: [] }, [range]);
  const rate = buffer.sampleRate;
  const start = Math.round(range.startMs * rate / 1000);
  const frames = Math.round(range.endMs * rate / 1000) - start;
  const channels = Math.min(2, buffer.numberOfChannels);
  const size = frames * channels * 2;
  if (size + 44 > MAX_UPLOAD_BYTES) throw new Error("This clip exceeds the 25 MB upload limit.");
  const bytes = new ArrayBuffer(size + 44);
  const view = new DataView(bytes);
  const tag = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  tag(0, "RIFF"); view.setUint32(4, size + 36, true); tag(8, "WAVE");
  tag(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, channels, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * channels * 2, true); view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true); tag(36, "data"); view.setUint32(40, size, true);
  const data = Array.from({ length: channels }, (_, i) => buffer.getChannelData(i));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][start + i]));
      view.setInt16(44 + (i * channels + c) * 2, Math.round(s * (s < 0 ? 32768 : 32767)), true);
    }
  }
  return bytes;
}

export async function makeClipFile(file: File, range: ClipRange): Promise<File> {
  const context = new AudioContext({ sampleRate: 44100 });
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    return new File([encodeClipWav(buffer, range)], "selected-clip.wav", { type: "audio/wav" });
  } finally {
    await context.close();
  }
}
