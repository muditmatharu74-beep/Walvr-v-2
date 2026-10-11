// Only leave after an accepted render or a durable queued job, never a generic 2xx.
export async function confirmSubmission(response: Response): Promise<void> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.error === "Not enough credits. Top up to continue." &&
        Number.isFinite(data.required) && Number.isFinite(data.credits)) {
      throw new Error(`Not enough credits. You need ${data.required} credits but only have ${data.credits}. Go to Settings to top up.`);
    }
    if (typeof data?.error === "string" && data.error.trim()) throw new Error(data.error);
    if (response.status === 401) throw new Error("Your session expired. Sign in again to continue.");
    if (response.status === 504) {
      throw new Error("The request timed out. Check your dashboard before creating another video; this request may still be processing.");
    }
    throw new Error("Could not confirm video creation. Check your dashboard before trying again.");
  }
  const queued = response.status === 202 && data?.success === true && data.status === "queued" &&
    typeof data.videoId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.videoId);
  if (!queued && (data?.success !== true || typeof data.renderId !== "string" || !data.renderId.trim())) {
    throw new Error("Could not confirm video creation. Check your dashboard before trying again.");
  }
}
