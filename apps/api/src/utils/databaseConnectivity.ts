/** pg/network error codes that mean "couldn't reach or lost the database", not an app bug. */
const DB_CONNECTIVITY_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  '57P03', // Postgres: cannot_connect_now
]);

export function isDatabaseConnectivityError(error: unknown): boolean {
  let current: unknown = error;
  // drizzle/pg wrap the root network error in `.cause`, sometimes more than one layer deep.
  for (let depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && DB_CONNECTIVITY_ERROR_CODES.has(code)) {
      return true;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
