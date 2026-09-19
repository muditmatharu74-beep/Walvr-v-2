export const MAX_UPLOAD_BYTES = 25_000_000;
export const AUDIO_EXTENSIONS = ["mp3", "mp4", "wav", "m4a"];

export function ownedUploadUrl(value: string, userId: string, supabaseUrl: string): URL {
  const url = new URL(value);
  const origin = new URL(supabaseUrl);
  const prefix = `/storage/v1/object/public/uploads/${userId}/`;
  const path = decodeURIComponent(url.pathname);
  const name = path.slice(prefix.length);
  const extension = name.split(".").pop()?.toLowerCase();
  if (url.origin !== origin.origin || url.protocol !== "https:" || url.username ||
      url.password || url.search || url.hash || !path.startsWith(prefix) ||
      !name || name.includes("/") || name.includes("\\") ||
      !AUDIO_EXTENSIONS.includes(extension ?? "")) {
    throw new Error("Choose an audio file uploaded to your own account");
  }
  return url;
}
