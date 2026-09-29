/**
 * Runs heavy jobs one at a time, in the order they were asked.
 *
 * Compiling a manuscript costs memory in proportion to the book (a PDF of tens of megabytes needs
 * hundreds while it is laid out); several publishes at once would multiply that. Each gate is its
 * own queue, and a job that fails does not hold up the ones behind it.
 */
export function createExclusiveGate() {
  let tail: Promise<unknown> = Promise.resolve();
  return function exclusively<T>(job: () => Promise<T> | T): Promise<T> {
    const run = tail.then(job, job);
    tail = run.catch(() => undefined);
    return run;
  };
}
