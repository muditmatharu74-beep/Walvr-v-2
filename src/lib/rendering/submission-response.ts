// Only leave the upload page after the API confirms an accepted render.
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
  if (data?.success !== true || typeof data.renderId !== "string" || !data.renderId.trim()) {
    throw new Error("Could not confirm video creation. Check your dashboard before trying again.");
  }
}
