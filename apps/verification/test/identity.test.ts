import { describe, expect, it } from 'vitest';
import {
  commitment,
  normalizeIdentity,
  normalizeKind,
  normalizeName,
  normalizeNumber,
} from '../src/crypto/commitment';
import { COMMITMENT_KEY } from './helpers/harness';

const OTHER_KEY = 'another-commitment-key-0123456789abcdef';
const CPF = { name: 'Maria da Conceição Souza', kind: 'CPF', number: '123.456.789-09' };

describe('identity normalisation', () => {
  it('folds the name: accents, case and runs of whitespace', () => {
    expect(normalizeName('José  da   Conceição')).toBe('JOSE DA CONCEICAO');
    expect(normalizeName('  maria\tsilva\n')).toBe('MARIA SILVA');
    expect(normalizeName('Ñandú')).toBe('NANDU');
  });

  it('keeps the punctuation of a name: an apostrophe or a hyphen is part of a surname', () => {
    expect(normalizeName("D'Ávila-Ramos")).toBe("D'AVILA-RAMOS");
  });

  it('folds the kind to lower case, trimmed', () => {
    expect(normalizeKind(' CPF ')).toBe('cpf');
    expect(normalizeKind('Passport')).toBe('passport');
  });

  it('keeps only the letters and digits of a number, in upper case', () => {
    expect(normalizeNumber('123.456.789-09')).toBe('12345678909');
    expect(normalizeNumber('12345678909')).toBe('12345678909');
    expect(normalizeNumber('ab 12/cd-3')).toBe('AB12CD3');
    expect(normalizeNumber('é1-2')).toBe('E12');
  });

  it('normalises a whole identity', () => {
    expect(normalizeIdentity(CPF)).toEqual({
      name: 'MARIA DA CONCEICAO SOUZA',
      kind: 'cpf',
      number: '12345678909',
    });
  });
});

describe('identity commitment', () => {
  it('is 64 lower-case hex characters and stable for the same identity', () => {
    const first = commitment(COMMITMENT_KEY, CPF);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(commitment(COMMITMENT_KEY, CPF)).toBe(first);
  });

  it('is the same for the same document typed with other accents, case, spacing and punctuation', () => {
    const typed = commitment(COMMITMENT_KEY, CPF);
    expect(
      commitment(COMMITMENT_KEY, {
        name: 'MARIA DA CONCEIÇÃO  SOUZA',
        kind: ' cpf',
        number: '12345678909',
      }),
    ).toBe(typed);
    expect(
      commitment(COMMITMENT_KEY, {
        name: 'maria da conceicao souza',
        kind: 'CPF',
        number: '123 456 789 09',
      }),
    ).toBe(typed);
  });

  it('differs per number, per name and per kind', () => {
    const typed = commitment(COMMITMENT_KEY, CPF);
    expect(commitment(COMMITMENT_KEY, { ...CPF, number: '123.456.789-10' })).not.toBe(typed);
    expect(commitment(COMMITMENT_KEY, { ...CPF, name: 'Maria Souza' })).not.toBe(typed);
    expect(commitment(COMMITMENT_KEY, { ...CPF, kind: 'rg' })).not.toBe(typed);
  });

  it('differs with another COMMITMENT_KEY: the same document is a different commitment on another service', () => {
    expect(commitment(OTHER_KEY, CPF)).not.toBe(commitment(COMMITMENT_KEY, CPF));
  });

  it('does not let the fields run together: the separator keeps two different identities apart', () => {
    const a = commitment(COMMITMENT_KEY, { name: 'AB', kind: 'cpf', number: '1' });
    const b = commitment(COMMITMENT_KEY, { name: 'A', kind: 'cpf', number: 'B1' });
    expect(a).not.toBe(b);
  });
});
