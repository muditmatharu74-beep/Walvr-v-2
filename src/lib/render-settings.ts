export const FPS = 30;
export function getSongDuration(duration: unknown): number {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    throw new Error("Audio duration is missing or invalid");
  }
  return duration;
}
export function getDurationInFrames(duration: unknown): number {
  return Math.max(1, Math.ceil(getSongDuration(duration) * FPS));
}
export function getRenderSize(plan: string) {
  return plan === "business" || plan === "studio"
    ? { width: 2160, height: 3840 } : { width: 1080, height: 1920 };
}
export function validateUploadUrl(fileUrl: string, supabaseUrl: string, userId: string) {
  const url = new URL(fileUrl);
  const base = new URL(supabaseUrl);
  if (url.origin !== base.origin || url.username || url.password ||
      !url.pathname.startsWith('/storage/v1/object/public/uploads/' + userId + '/')) {
    throw new Error("Select an audio file uploaded to your account");
  }
}
