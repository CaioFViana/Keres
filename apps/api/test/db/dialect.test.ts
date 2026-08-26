import { describe, expect, it } from 'vitest';
import {
  isForeignKeyConstraint,
  isUniqueViolation,
  postgresErrorConstraint,
} from '../../src/utils/errors';

/**
 * The differences between the two engines the code has to recognise.
 *
 * These cases need no database up: they are the translation of the errors each driver returns. They
 * cover exactly what broke during the port - a SQLite uniqueness error looks nothing like Postgres's,
 * and mishandling that turns a clean 409 into a 500.
 */

/** Um erro como o drizzle o entrega: o dele por fora, o do driver pendurado em `cause`. */
function drizzleError(cause: Record<string, unknown>): Error {
  return Object.assign(new Error('Failed query: insert into "users" ...'), { cause });
}

describe('unique violations, in either engine', () => {
  it('recognises the Postgres code', () => {
    expect(isUniqueViolation(drizzleError({ code: '23505' }))).toBe(true);
  });

  it('recognises the SQLite constraint', () => {
    const error = drizzleError({
      code: 'SQLITE_CONSTRAINT',
      message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: users.username',
    });
    expect(isUniqueViolation(error)).toBe(true);
  });

  // SQLite uses the same code for every constraint. Mistaking a foreign key for a uniqueness violation
  // would make registration retry, with another tag, forever.
  it('does not mistake another SQLite constraint for a unique one', () => {
    const error = drizzleError({
      code: 'SQLITE_CONSTRAINT',
      message: 'SQLITE_CONSTRAINT: FOREIGN KEY constraint failed',
    });
    expect(isUniqueViolation(error)).toBe(false);
  });

  it('says no to an error that is not about constraints', () => {
    expect(isUniqueViolation(new Error('connection refused'))).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});

describe('foreign key violations, in either engine', () => {
  it('recognises the Postgres code', () => {
    expect(isForeignKeyConstraint(drizzleError({ code: '23503' }))).toBe(true);
  });

  it('recognises the SQLite constraint', () => {
    const error = drizzleError({
      code: 'SQLITE_CONSTRAINT',
      message: 'SQLITE_CONSTRAINT: FOREIGN KEY constraint failed',
    });
    expect(isForeignKeyConstraint(error)).toBe(true);
  });

  it('does not mistake a unique SQLite constraint for a foreign key one', () => {
    const error = drizzleError({
      code: 'SQLITE_CONSTRAINT',
      message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: users.username',
    });
    expect(isForeignKeyConstraint(error)).toBe(false);
  });
});

describe('which constraint was violated', () => {
  it('uses the name the Postgres driver reports', () => {
    expect(postgresErrorConstraint(drizzleError({ constraint: 'users_tag_lower_idx' }))).toBe(
      'users_tag_lower_idx',
    );
  });

  // On an expression index (`lower(tag)`) SQLite gives the index's name...
  it('reads the index name out of the SQLite message', () => {
    const error = drizzleError({
      code: 'SQLITE_CONSTRAINT',
      message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: index 'users_tag_lower_idx'",
    });
    expect(postgresErrorConstraint(error)).toBe('users_tag_lower_idx');
  });

  // ...and on an ordinary index, the columns.
  it('falls back to the columns when SQLite names no index', () => {
    const error = drizzleError({
      code: 'SQLITE_CONSTRAINT',
      message: 'SQLITE_CONSTRAINT: UNIQUE constraint failed: users.username',
    });
    expect(postgresErrorConstraint(error)).toBe('users_username');
  });

  it('answers nothing when the error says nothing', () => {
    expect(postgresErrorConstraint(new Error('boom'))).toBeUndefined();
  });
});
