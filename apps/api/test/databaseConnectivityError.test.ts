import { describe, expect, it } from 'vitest';
import { isDatabaseConnectivityError } from '../src/index';

const withCode = (code: string, cause?: unknown) => Object.assign(new Error(code), { code, cause });

/**
 * Este classificador decide entre 503 ("o banco caiu, tente de novo") e 500 ("bug nosso") em
 * `onError`. Errar para o lado do 500 esconde uma queda de banco atrás de um erro genérico.
 */
describe('isDatabaseConnectivityError', () => {
  it.each([
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN',
    '57P03',
  ])('treats %s as the database being unreachable', (code) => {
    expect(isDatabaseConnectivityError(withCode(code))).toBe(true);
  });

  it('unwraps the root network error that drizzle/pg hide under .cause', () => {
    const wrapped = new Error('query failed', { cause: withCode('ECONNREFUSED') });

    expect(isDatabaseConnectivityError(wrapped)).toBe(true);
  });

  it('unwraps several layers of cause', () => {
    const deep = new Error('a', {
      cause: new Error('b', { cause: new Error('c', { cause: withCode('ETIMEDOUT') }) }),
    });

    expect(isDatabaseConnectivityError(deep)).toBe(true);
  });

  it('gives up past the depth limit instead of walking an unbounded chain', () => {
    let error: Error = withCode('ECONNREFUSED');
    for (let depth = 0; depth < 6; depth++) {
      error = new Error(`layer ${depth}`, { cause: error });
    }

    expect(isDatabaseConnectivityError(error)).toBe(false);
  });

  it('survives a cause chain that loops back on itself', () => {
    const first = new Error('first');
    const second = new Error('second', { cause: first });
    (first as { cause?: unknown }).cause = second;

    expect(isDatabaseConnectivityError(first)).toBe(false);
  });

  it.each([
    ['an application bug', new Error('cannot read property of undefined')],
    ['a Postgres constraint violation', withCode('23505')],
    ['a code that is not a string', Object.assign(new Error('weird'), { code: 500 })],
    ['null', null],
    ['undefined', undefined],
    ['a plain string', 'ECONNREFUSED'],
  ])('does not treat %s as a connectivity failure', (_label, error) => {
    expect(isDatabaseConnectivityError(error)).toBe(false);
  });
});
