/**
 * Work the server starts without making anybody wait for it - a line of the activity record, a row of the
 * technical log, a sweep - kept in view so a stopping server can wait for it to land. Without this, the
 * process exits with those writes half-done and the last lines before a shutdown are the ones missing.
 */
const pending = new Set<Promise<unknown>>();

/** Notes `work` as running until it settles. Returns it untouched; the caller handles its failure. */
export function trackBackground<T>(work: Promise<T>): Promise<T> {
  pending.add(work);
  const done = () => {
    pending.delete(work);
  };
  work.then(done, done);
  return work;
}

export function pendingBackgroundCount(): number {
  return pending.size;
}

/**
 * Waits until nothing tracked is running, or `timeoutMs` passes. Work that starts while waiting (a log line
 * written by the very write being waited for) is waited for too. Says what was left when time ran out.
 */
export async function drainBackground(
  timeoutMs: number,
): Promise<{ drained: boolean; remaining: number }> {
  const deadline = Date.now() + timeoutMs;
  while (pending.size > 0) {
    const left = deadline - Date.now();
    if (left <= 0) break;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, left);
    });
    await Promise.race([Promise.allSettled([...pending]), timeout]);
    clearTimeout(timer);
  }
  return { drained: pending.size === 0, remaining: pending.size };
}
