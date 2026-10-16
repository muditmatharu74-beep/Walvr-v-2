export type NeonBackground = {src: string; duration: number};

// The source is a server-configured asset, never a URL supplied by the browser.
export function previewNeonBackground(env: Record<string, string | undefined>): NeonBackground | undefined {
  if (env.VERCEL_ENV !== "preview" || env.VERCEL_GIT_COMMIT_REF !== "feature/neon-captions") return;
  const src = env.WALVR_NEON_BACKGROUND_URL;
  const rawDuration = env.WALVR_NEON_BACKGROUND_DURATION;
  if (!src && !rawDuration) return;
  if (!src || !rawDuration) throw new Error("Configure both neon background URL and duration");
  const url = new URL(src);
  const duration = Number(rawDuration);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.search ||
      !Number.isFinite(duration) || duration <= 0 || duration > 600) {
    throw new Error("Invalid neon background asset configuration");
  }
  return {src: url.href, duration};
}
