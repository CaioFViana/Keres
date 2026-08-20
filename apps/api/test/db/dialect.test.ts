import { describe, expect, it } from 'vitest';
import { isUniqueViolation, postgresErrorConstraint } from '../../src/utils/errors';

/**
 * As diferenças entre os dois motores que o código precisa reconhecer.
 *
 * Estes casos não dependem de banco no ar: são a tradução dos erros que cada driver devolve.
 * Cobrem justamente o que quebrou ao portar - um erro de unicidade do SQLite não se parece em
 * nada com o do Postgres, e tratar mal isso transforma um 409 limpo num 500.
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

  // O SQLite usa o mesmo código para toda restrição. Confundir uma chave estrangeira com uma
  // violação de unicidade faria o cadastro tentar de novo, com outra tag, para sempre.
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

describe('which constraint was violated', () => {
  it('uses the name the Postgres driver reports', () => {
    expect(postgresErrorConstraint(drizzleError({ constraint: 'users_tag_lower_idx' }))).toBe(
      'users_tag_lower_idx',
    );
  });

  // Num índice de expressão (`lower(tag)`) o SQLite dá o nome do índice...
  it('reads the index name out of the SQLite message', () => {
    const error = drizzleError({
      code: 'SQLITE_CONSTRAINT',
      message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: index 'users_tag_lower_idx'",
    });
    expect(postgresErrorConstraint(error)).toBe('users_tag_lower_idx');
  });

  // ...e num índice comum, as colunas.
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
