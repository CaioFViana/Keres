import { describe, expect, it } from 'vitest';
import {
  AppError,
  isUniqueViolation,
  postgresErrorCode,
  postgresErrorConstraint,
} from '../../src/utils/errors';

const withCode = (code: string) => Object.assign(new Error(code), { code });
const withConstraint = (constraint: string) => Object.assign(new Error(constraint), { constraint });

/** Como o drizzle entrega um erro do `pg`: embrulhado, com o original em `cause`. */
const wrappedByDrizzle = (cause: unknown) =>
  new Error('Failed query: insert into "users" ...', { cause });

describe('AppError', () => {
  it('carries the status the route chose alongside a user-facing message', () => {
    const error = new AppError(409, 'Story already exists.');

    expect(error.status).toBe(409);
    expect(error.message).toBe('Story already exists.');
  });

  it('is a real Error, so `instanceof` in onError and stack traces both work', () => {
    const error = new AppError(403, 'Forbidden.');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.name).toBe('AppError');
    expect(error.stack).toBeDefined();
  });

  it('stays distinguishable from a plain Error that happened to reach 500', () => {
    expect(new Error('boom')).not.toBeInstanceOf(AppError);
    expect(new AppError(500, 'Deliberate 500.')).toBeInstanceOf(AppError);
  });
});

describe('postgresErrorCode', () => {
  it('reads the code straight off a pg error', () => {
    expect(postgresErrorCode(withCode('23505'))).toBe('23505');
  });

  it('finds the code the drizzle wrapper hid in cause', () => {
    expect(postgresErrorCode(wrappedByDrizzle(withCode('23505')))).toBe('23505');
  });

  it('digs through several layers of cause', () => {
    expect(postgresErrorCode(wrappedByDrizzle(wrappedByDrizzle(withCode('23503'))))).toBe('23503');
  });

  it.each([
    ['an error with no code', new Error('boom')],
    ['null', null],
    ['undefined', undefined],
    ['a string', '23505'],
  ])('returns nothing for %s', (_label, value) => {
    expect(postgresErrorCode(value)).toBeUndefined();
  });

  it('gives up past the depth limit rather than walking forever', () => {
    let error: Error = withCode('23505');
    for (let depth = 0; depth < 6; depth++) {
      error = wrappedByDrizzle(error);
    }

    expect(postgresErrorCode(error)).toBeUndefined();
  });
});

describe('postgresErrorConstraint', () => {
  it('reads the constraint name straight off a pg error', () => {
    expect(postgresErrorConstraint(withConstraint('users_username_unique'))).toBe(
      'users_username_unique',
    );
  });

  it('finds the constraint name the drizzle wrapper hid in cause', () => {
    expect(postgresErrorConstraint(wrappedByDrizzle(withConstraint('users_tag_lower_idx')))).toBe(
      'users_tag_lower_idx',
    );
  });

  it('returns nothing when the error carries no constraint name', () => {
    expect(postgresErrorConstraint(new Error('boom'))).toBeUndefined();
    expect(postgresErrorConstraint(withCode('23505'))).toBeUndefined();
  });
});

/**
 * Esta é a checagem que decide se um `INSERT` que bateu numa restrição de unicidade cai no
 * caminho alternativo da rota (tag com sufixo, mensagem de "já existe") ou vira um 500. Antes
 * de existir, o `catch` comparava `error.code` direto e nunca era verdadeiro sob o drizzle.
 */
describe('isUniqueViolation', () => {
  it('recognises a unique violation raised by pg', () => {
    expect(isUniqueViolation(withCode('23505'))).toBe(true);
  });

  it('recognises one wrapped by drizzle', () => {
    expect(isUniqueViolation(wrappedByDrizzle(withCode('23505')))).toBe(true);
  });

  it.each([
    ['a foreign key violation', '23503'],
    ['a not-null violation', '23502'],
    ['a connection failure', 'ECONNREFUSED'],
  ])('does not confuse %s with a unique violation', (_label, code) => {
    expect(isUniqueViolation(withCode(code))).toBe(false);
    expect(isUniqueViolation(wrappedByDrizzle(withCode(code)))).toBe(false);
  });

  it('is false for an ordinary application error', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });
});
