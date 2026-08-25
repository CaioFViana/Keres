/**
 * A route deliberately rejecting a request with a specific status and a safe,
 * user-facing message - as opposed to an error that merely bubbled up from a library
 * (drizzle/pg, a bug, etc.) and defaults to `set.status = 500` the same way Elysia does
 * for any unclassified thrown error. That collision is why `set.status === 500` alone
 * can't tell "the app chose 500 on purpose" apart from "nothing chose it" - this class
 * is the unambiguous signal `onError` needs to relay the former and sanitize the latter.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** `unique_violation` do Postgres. */
const UNIQUE_VIOLATION = '23505';
/** `foreign_key_violation` do Postgres. */
const FOREIGN_KEY_VIOLATION = '23503';
/** SQLite does not distinguish which constraint was violated by code; the text is what says so. */
const SQLITE_CONSTRAINT = 'SQLITE_CONSTRAINT';

/**
 * The database's error code, also looked for in `.cause`.
 *
 * drizzle does not pass the driver's error through: it throws an `Error` of its own ("Failed query:
 * ...") with the original hanging off `cause`. That is why a `(error as { code?: string }).code ===
 * '23505'` written directly in the `catch` is never true for a query made through drizzle - the
 * handling becomes dead code and the route returns a 500 instead of the result it meant to give.
 */
export function postgresErrorCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** The driver's error message, also looked for in `.cause` (the same reason as the code above). */
function errorMessageChain(error: unknown): string {
  const messages: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const message = (current as { message?: unknown }).message;
    if (typeof message === 'string') {
      messages.push(message);
    }
    current = (current as { cause?: unknown }).cause;
  }
  return messages.join(' | ');
}

/**
 * A uniqueness constraint violation, whichever the engine.
 *
 * Postgres has a code just for that (`23505`). SQLite returns `SQLITE_CONSTRAINT` for any constraint -
 * foreign key, `NOT NULL`, `CHECK` - and only the text says which one it was, hence the check by
 * message. Mistaking a foreign key violation for a uniqueness one would, for instance, make
 * registration retry with another tag forever.
 */
export function isUniqueViolation(error: unknown): boolean {
  const code = postgresErrorCode(error);
  if (code === UNIQUE_VIOLATION) {
    return true;
  }
  return code === SQLITE_CONSTRAINT && /UNIQUE constraint failed/i.test(errorMessageChain(error));
}

/**
 * A foreign key violation, whichever the engine.
 *
 * A mirror of `isUniqueViolation`: Postgres has its own code (`23503`); SQLite returns the same
 * `SQLITE_CONSTRAINT` for any constraint and only the text ("FOREIGN KEY constraint failed") says
 * which one it was. Used by the `api_logs` sink, which tries to write `userId`/`storyId` extracted
 * from the meta and must not let a 401 against a story that does not exist on this server become a
 * stack dump in place of the log itself.
 */
export function isForeignKeyConstraint(error: unknown): boolean {
  const code = postgresErrorCode(error);
  if (code === FOREIGN_KEY_VIOLATION) {
    return true;
  }
  return (
    code === SQLITE_CONSTRAINT && /FOREIGN KEY constraint failed/i.test(errorMessageChain(error))
  );
}

/**
 * Name of the constraint/index that caused the violation (e.g. `users_username_unique`), looked for
 * in `.cause` for the same reason as `postgresErrorCode`. A table can have more than one uniqueness
 * constraint - `isUniqueViolation` alone does not say which one was violated, and assuming it can only
 * be a specific one (say, username vs tag in `users`) makes a retry designed for a real collision
 * retry the same operation, without checking this, against a different constraint that will never pass.
 */
export function postgresErrorConstraint(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const constraint = (current as { constraint?: unknown }).constraint;
    if (typeof constraint === 'string') {
      return constraint;
    }
    current = (current as { cause?: unknown }).cause;
  }

  // SQLite does not expose the constraint in a field: it comes in the text, and in two shapes. For an
  // expression index (`lower(tag)`) it gives the index's name - which is exactly what the caller
  // compares; for an ordinary index, it gives the columns.
  const message = errorMessageChain(error);
  const namedIndex = /UNIQUE constraint failed: index '([^']+)'/i.exec(message)?.[1];
  if (namedIndex) {
    return namedIndex;
  }
  const columns = /UNIQUE constraint failed: ([\w., ]+)/i.exec(message)?.[1];
  return columns?.trim().replace(/\./g, '_');
}
