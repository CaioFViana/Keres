/**
 * What a `catch` can read from a caught value. TypeScript types it `unknown` (it can be anything that was
 * thrown), so each reader checks the shape instead of trusting it.
 */

/** The message of a thrown `Error`, or of anything shaped like one; undefined for other values. */
export function errorMessageOf(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const { message } = error as { message?: unknown };
  return typeof message === 'string' ? message : undefined;
}

/** The HTTP status of a failed request (an axios error carries it on `response`), if the server answered. */
export function httpStatusOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const status = (error as { response?: { status?: unknown } }).response?.status;
  return typeof status === 'number' ? status : undefined;
}
