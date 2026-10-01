/**
 * Races `promise` against a `ms` deadline. Whoever settles first wins; the timer is always
 * cleared, and the loser's late settlement stays handled by the race (no unhandled
 * rejection). Used where a hang must degrade instead of wedging boot: the caller boots
 * without the awaited capability when this rejects.
 */
export function promiseWithTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
