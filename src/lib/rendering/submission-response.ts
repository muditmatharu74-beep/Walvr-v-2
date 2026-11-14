export class SubmissionUnconfirmedError extends Error {
  constructor(message = "Could not confirm video creation. Check your dashboard before trying again.") {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = "SubmissionUnconfirmedError";
  }
}

// A network failure can hide acceptance. Never automatically repeat this POST.
export async function submitAndConfirm(
  fetcher: typeof fetch, request: RequestInit, timeoutMs = 120_000,
): Promise<void> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (request.signal?.aborted) abort();
  else request.signal?.addEventListener("abort", abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Aborting the browser request does not cancel an accepted server job.
      reject(new SubmissionUnconfirmedError());
      controller.abort();
    }, timeoutMs);
  });
  try {
    await Promise.race([
      (async () => {
        let response: Response;
        try { response = await fetcher("/api/process", { ...request, signal: controller.signal }); }
        catch { throw new SubmissionUnconfirmedError(); }
        // Include body reading in the deadline: headers alone are not a receipt.
        await confirmSubmission(response);
      })(),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", abort);
  }
}

// Only leave after an accepted render or a durable queued job, never a generic 2xx.
export async function confirmSubmission(response: Response): Promise<void> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const uncertain = response.status >= 500 || response.status === 409;
    // This explicit code is emitted before reservation or provider submission.
    const configuredRejection = response.status === 503 && data?.code === "RENDERER_NOT_CONFIGURED";
    if (uncertain && !configuredRejection) {
      const message = typeof data?.error === "string" && data.error.trim() ? data.error :
        response.status === 504 ? "The request timed out. Check your dashboard before creating another video; this request may still be processing." : undefined;
      throw new SubmissionUnconfirmedError(message);
    }
    if (data?.error === "Not enough credits. Top up to continue." &&
        Number.isFinite(data.required) && Number.isFinite(data.credits)) {
      throw new Error(`Not enough credits. You need ${data.required} credits but only have ${data.credits}. Go to Settings to top up.`);
    }
    if (typeof data?.error === "string" && data.error.trim()) throw new Error(data.error);
    if (response.status === 401) throw new Error("Your session expired. Sign in again to continue.");
    throw new SubmissionUnconfirmedError();
  }
  const queued = response.status === 202 && data?.success === true && data.status === "queued" &&
    typeof data.videoId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.videoId);
  if (!queued && (data?.success !== true || typeof data.renderId !== "string" || !data.renderId.trim())) {
    throw new SubmissionUnconfirmedError();
  }
}
