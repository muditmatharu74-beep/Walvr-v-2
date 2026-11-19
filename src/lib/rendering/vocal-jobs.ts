import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { MAX_UPLOAD_BYTES, ownedUploadUrl } from "./upload";
import { vocalTimingForRender } from "./vocal-timing";
import { assertUsableTranscription } from "./transcription-quality";
import { isNeonStyle, type CaptionStyle } from "./neon-captions";
import { assertDarkLyricsConfigured, startDarkLyricsRender } from "./remotion";

// First rollout is preview-only, Dark Lyrics only. Never run ML inside Next.js.
export function vocalJobsEnabled() {
  return process.env.WALVR_VOCAL_TIMING_ENABLED === "true" && process.env.VERCEL_ENV === "preview";
}
export function assertVocalWorkerConfigured() {
  if (!vocalJobsEnabled() || (process.env.WALVR_VOCAL_WORKER_SECRET?.length ?? 0) < 32) {
    throw new Error("Vocal timing worker is not configured");
  }
}
export function vocalWorkerAuthorized(header: string | null) {
  if (!vocalJobsEnabled()) return false;
  const secret = process.env.WALVR_VOCAL_WORKER_SECRET ?? "";
  if (secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function originalUploadHash(url: string, userId: string) {
  ownedUploadUrl(url, userId, process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const response = await fetch(url, {redirect: "error", signal: AbortSignal.timeout(30000)});
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) > MAX_UPLOAD_BYTES) {
    throw new Error("Could not read uploaded audio");
  }
  const reader = response.body.getReader();
  const hash = createHash("sha256");
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_BYTES) throw new Error("Audio exceeds 25 MB");
      hash.update(value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  if (!size) throw new Error("Uploaded audio is empty");
  return hash.digest("hex");
}

export async function enqueueVocalJob(db: SupabaseClient, input: {
  userId: string; videoId: string; fileUrl: string; captionStyle: CaptionStyle;
  cost: number; plan: string;
}) {
  assertVocalWorkerConfigured();
  // Download/hash before the atomic reservation: invalid uploads never charge.
  const hash = await originalUploadHash(input.fileUrl, input.userId);
  try {
    const {data, error} = await db.rpc("enqueue_vocal_job", {
      p_user_id: input.userId, p_video_id: input.videoId, p_url: input.fileUrl,
      p_sha256: hash, p_caption_style: input.captionStyle, p_cost: input.cost, p_plan: input.plan,
    });
    if (error || !data) throw error ?? new Error("Missing queue receipt");
    return data as {status: string; credits: number};
  } catch {
    throw new Error("Could not confirm lyric processing. Check your dashboard before creating another video.");
  }
}

type VocalJob = {
  video_id: string; user_id: string; source_url: string; source_sha256: string;
  caption_style: CaptionStyle; result: unknown; original_duration: number;
};

export async function resumeVocalRender(db: SupabaseClient) {
  assertVocalWorkerConfigured();
  assertDarkLyricsConfigured();
  const {data, error} = await db.rpc("claim_vocal_render");
  if (error) throw error;
  if (!data) return false;
  const job = data as VocalJob;
  let submissionStarted = false;
  try {
    // Recheck the source before a paid render. Never use the stem as final audio.
    if (await originalUploadHash(job.source_url, job.user_id) !== job.source_sha256) {
      throw new Error("Original upload changed");
    }
    const timing = vocalTimingForRender(job.result, {sha256: job.source_sha256, duration: job.original_duration});
    assertUsableTranscription(timing, isNeonStyle(job.caption_style));
    submissionStarted = true; // A thrown provider call can still have accepted a render.
    const render = await startDarkLyricsRender({captions: timing.words, beats: timing.beats,
      songDuration: timing.duration, audioUrl: job.source_url, captionStyle: job.caption_style});
    const {error: savedError} = await db.rpc("finish_vocal_render", {
      p_video_id: job.video_id, p_render_id: render.id, p_bucket: render.bucketName,
      p_function: render.functionName, p_region: render.region,
    });
    if (savedError) throw savedError;
  } catch {
    // After submission, preserve credits and tracking uncertainty; never auto-resubmit.
    const {error: failedError} = await db.rpc("stop_vocal_render", {
      p_video_id: job.video_id, p_uncertain: submissionStarted,
    });
    if (failedError) throw failedError;
  }
  return true;
}

export async function completeVocalAnalysis(db: SupabaseClient, input: {
  videoId: string; token: string; result: unknown; originalDuration: number;
}) {
  const {data: job, error} = await db.from("vocal_jobs").select("source_sha256, caption_style")
    .eq("video_id", input.videoId).eq("lease_token", input.token).eq("state", "analyzing").maybeSingle();
  if (error) throw error;
  if (!job) return {status: "stale"};
  try {
    const timing = vocalTimingForRender(input.result, {sha256: job.source_sha256, duration: input.originalDuration});
    assertUsableTranscription(timing, isNeonStyle(job.caption_style));
  } catch {
    const {data, error: stopError} = await db.rpc("finish_vocal_analysis", {
      p_video_id: input.videoId, p_token: input.token, p_result: null, p_duration: null, p_failure: "lyrics_unusable",
    });
    if (stopError) throw stopError;
    return data;
  }
  const {data, error: savedError} = await db.rpc("finish_vocal_analysis", {
    p_video_id: input.videoId, p_token: input.token, p_result: input.result,
    p_duration: input.originalDuration, p_failure: null,
  });
  if (savedError) throw savedError;
  return data;
}
