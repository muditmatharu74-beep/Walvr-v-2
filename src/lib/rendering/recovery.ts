import type { SupabaseClient } from "@supabase/supabase-js";
import { readRenderStatus, type RenderJob } from "./status";

type RecoveryJob = RenderJob & { recovery_next_check: string };
const delay = (now: number, minutes: number) => new Date(now + minutes * 60000).toISOString();

export async function recoverRenders(db: SupabaseClient, now = Date.now()) {
  // Oldest due first: an unavailable provider must not starve newer jobs.
  const { data, error } = await db.from("videos").select("*")
    .in("status", ["processing", "rendering"])
    .lte("recovery_next_check", new Date(now).toISOString())
    .order("recovery_next_check").limit(10);
  if (error) throw error;
  const counts = { checked: 0, completed: 0, failed: 0, review: 0, retry: 0, skipped: 0 };
  await Promise.all((data as RecoveryJob[] ?? []).map(async video => {
    // Compare-and-swap lease: two workers reading the same due row cannot both claim it.
    // A killed worker leaves a bounded lease, so a later run can retry.
    const lease = delay(now, 15);
    const { data: claimed, error: claimError } = await db.from("videos")
      .update({ recovery_next_check: lease })
      .eq("id", video.id).eq("status", video.status)
      .eq("recovery_next_check", video.recovery_next_check).select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) { counts.skipped++; return; }
    counts.checked++;
    const note = async (reason: string | null, minutes: number) => {
      const { error: noteError } = await db.from("videos").update({
        recovery_reason: reason, recovery_next_check: delay(now, minutes),
      }).eq("id", video.id).eq("status", video.status).eq("recovery_next_check", lease);
      if (noteError) throw noteError;
    };
    try {
      if (video.status === "processing" || !video.render_id ||
        (!video.render_provider && video.clip_style === "dark-solid") ||
        (video.render_provider === "remotion" && (!video.render_bucket || !video.render_function || !video.render_region))) {
        // Never re-submit an uncertain job or refund merely because it is old.
        await note("manual_review_missing_submission_tracking", 1440);
        counts.review++;
        return;
      }
      const result = await readRenderStatus(video);
      if (result.status === "rendering") { await note(null, 15); return; }
      const { data: settled, error: settlementError } = await db.rpc("settle_video_credits", {
        p_user_id: video.user_id, p_video_id: video.id, p_status: result.status,
        p_render_id: video.render_id, p_url: result.url,
      });
      if (settlementError) throw settlementError;
      // The transaction is authoritative if dashboard polling settled first.
      if (settled.status === "done") counts.completed++;
      if (settled.status === "error") counts.failed++;
    } catch (err) {
      counts.retry++;
      console.error("Render recovery retry", { videoId: video.id, error: err });
      await note("provider_or_settlement_retry", 15);
    }
  }));
  return counts;
}
