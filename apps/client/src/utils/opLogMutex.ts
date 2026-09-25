/**
 * Per-story promise chains serializing op-log version assignment.
 *
 * `recordLocalOperation` and `recordRebasedOperation` sequence `operationVersion` as
 * read-counter → insert → bump-story over three awaits; two concurrent writers read the
 * same counter and insert the same version. Both wrap that section in `withOpLogLock`
 * with the story id as key, so versions stay a dense per-story sequence. No
 * dependencies and no app imports, so neither caller can form an import cycle.
 */
const tails = new Map<string, Promise<unknown>>();

const swallow = () => {};

export function withOpLogLock<T>(storyId: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(storyId) ?? Promise.resolve();
  // The chain entry swallows rejections so one failed write never stalls the story's
  // later writes; the caller's own promise still rejects with the real error.
  const next = previous.catch(swallow).then(fn);
  const tail = next.catch(swallow);
  tails.set(storyId, tail);
  tail.then(() => {
    if (tails.get(storyId) === tail) tails.delete(storyId);
  });
  return next;
}
