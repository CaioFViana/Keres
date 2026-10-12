import { createHmac } from 'node:crypto';

/**
 * The identity commitment: what the service keeps, and tells Keres, about the document a reviewer checked. An HMAC
 * under `COMMITMENT_KEY` (which never leaves this service and is in no database or backup) over the normalised name,
 * document kind and document number. Not a salted hash: a national number has too small a space to hide behind a
 * salt stored next to it, so the key must stay out of reach. Two people's documents, or one document typed with
 * different punctuation or accents, must give the same commitment; that is what normalisation is for.
 */

export interface IdentityInput {
  name: string;
  kind: string;
  number: string;
}

export interface NormalizedIdentity {
  name: string;
  kind: string;
  number: string;
}

/** Removes diacritics: NFKD splits "é" into "e" and a combining mark, and the marks are dropped. */
function stripDiacritics(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}+/gu, '');
}

/**
 * Name: diacritics stripped, upper case, runs of whitespace collapsed to one space. Punctuation is kept: an apostrophe
 * or a hyphen is part of a surname, and the reviewer reads it the same way on every document.
 */
export function normalizeName(name: string): string {
  return stripDiacritics(name).toUpperCase().replace(/\s+/g, ' ').trim();
}

/** Kind: lower case, trimmed. ("CPF", " cpf " and "Cpf" are one kind.) */
export function normalizeKind(kind: string): string {
  return kind.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Number: every character that is not a letter or a digit is dropped ("123.456.789-09" and "12345678909" are one
 * number), accents are stripped, upper case. Only the ASCII letters and digits that remain are kept.
 */
export function normalizeNumber(number: string): string {
  return stripDiacritics(number)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function normalizeIdentity(input: IdentityInput): NormalizedIdentity {
  return {
    name: normalizeName(input.name),
    kind: normalizeKind(input.kind),
    number: normalizeNumber(input.number),
  };
}

/**
 * The commitment of a normalised identity under `commitmentKey`: 64 lower-case hex characters, the shape Keres
 * validates. The three fields are joined with a newline, which normalisation never leaves inside a field, so two
 * different identities cannot produce the same input string.
 */
export function commitment(commitmentKey: string, input: IdentityInput): string {
  const normalized = normalizeIdentity(input);
  return createHmac('sha256', commitmentKey)
    .update([normalized.name, normalized.kind, normalized.number].join('\n'))
    .digest('hex');
}
