/**
 * A route deliberately rejecting a request with a specific status and a safe,
 * user-facing message - as opposed to an error that merely bubbled up from a library
 * (drizzle/pg, a bug, etc.) and defaults to `set.status = 500` the same way Elysia does
 * for any unclassified thrown error. That collision is why `set.status === 500` alone
 * can't tell "the app chose 500 on purpose" apart from "nothing chose it" - this class
 * is the unambiguous signal `onError` needs to relay the former and sanitize the latter.
 */
export class AppError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}
