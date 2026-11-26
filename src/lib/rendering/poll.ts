// Start the next refresh only after this one settles. Cleanup prevents rescheduling.
export function startPolling(task: () => Promise<void>, delayMs = 10_000): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function run() {
    try { await task(); }
    catch { /* Individual loaders display errors; later refreshes can recover. */ }
    finally {
      if (!stopped) timer = setTimeout(run, delayMs);
    }
  }
  void run();
  return () => { stopped = true; clearTimeout(timer); };
}
