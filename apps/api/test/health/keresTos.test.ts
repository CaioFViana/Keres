import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';
import {
  SERVER_TERMS,
  SERVER_TERMS_VERSION,
  serverTermsDigest,
  serverTermsFor,
  type ServerTermsSection,
} from '../../src/legal/serverTerms';

describe('GET /api/keres-tos', () => {
  it('serves the versioned terms with no session', async () => {
    const app = await createApp();

    const response = await app.handle(new Request('http://localhost/api/keres-tos'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      version: number;
      updatedAt: string;
      en: { heading: string; paragraphs: string[] }[];
      pt: { heading: string; paragraphs: string[] }[];
    };
    expect(body.version).toBe(SERVER_TERMS_VERSION);
    expect(typeof body.updatedAt).toBe('string');
    for (const language of [body.en, body.pt] as const) {
      expect(language.length).toBeGreaterThan(0);
      for (const section of language) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });
});

const required = serverTermsFor('required');
const disabled = serverTermsFor('disabled');
const NUMBERS = Array.from({ length: 11 }, (_, index) => String(index + 1));

const textOf = (sections: ServerTermsSection[]) =>
  sections.flatMap((section) => [section.heading, ...section.paragraphs]).join('\n');
const numberOf = (section: ServerTermsSection) => section.heading.split('.')[0];

describe('the server terms by age-verification mode', () => {
  it('bumps the version past the one clients may have accepted', () => {
    expect(SERVER_TERMS_VERSION).toBeGreaterThanOrEqual(3);
  });

  it('keeps the same sections, in the same order, in both languages and in both modes', () => {
    for (const document of [required, disabled]) {
      expect(document.en.map(numberOf)).toEqual(NUMBERS);
      expect(document.pt.map(numberOf)).toEqual(NUMBERS);
    }
  });

  it('serves the required text through the constant the route still reads', () => {
    expect(SERVER_TERMS).toEqual(required);
  });

  it('gives a disabled server a different text, and a different digest for the acceptances', () => {
    expect(textOf(disabled.en)).not.toBe(textOf(required.en));
    expect(textOf(disabled.pt)).not.toBe(textOf(required.pt));
    expect(serverTermsDigest('disabled')).not.toBe(serverTermsDigest('required'));
    expect(serverTermsDigest()).toBe(serverTermsDigest('required'));
  });

  it('states plainly that a disabled server has no age verification, no adults-only area and no verified account', () => {
    expect(textOf(disabled.en)).toMatch(/No age verification on this server/);
    expect(textOf(disabled.en)).toMatch(/no adults-only area exists/);
    expect(textOf(disabled.en)).toMatch(/no account is verified/);
    expect(textOf(disabled.pt)).toMatch(/Sem verificação de idade neste servidor/);
    expect(textOf(disabled.pt)).toMatch(/não existe área adulta/);
    expect(textOf(disabled.pt)).toMatch(/nenhuma conta é verificada/);
  });

  it('leaves out, in a disabled server, every clause that presupposes a verification', () => {
    expect(textOf(disabled.en)).not.toMatch(/becomes active|only after|pending|is approved|revok/i);
    expect(textOf(disabled.pt)).not.toMatch(/fica ativa|pendente|depois que a verificação|revog/i);
  });

  it('does not claim "no age verification" in a required server', () => {
    expect(textOf(required.en)).not.toMatch(/no age verification/i);
    expect(textOf(required.pt)).not.toMatch(/sem verificação de idade/i);
  });

  it('says that in a required server the account becomes active only after the verification', () => {
    expect(textOf(required.en)).toMatch(/becomes active only after the verification is approved/);
    expect(textOf(required.pt)).toMatch(
      /A conta só fica ativa depois que a verificação é aprovada/,
    );
  });

  it('carries every age-verification clause into a required server, in English', () => {
    const en = textOf(required.en);
    for (const clause of [
      /18 or older/,
      /Registration stays pending/,
      /belongs to someone else verifies nobody/,
      /never a dead end/,
      /a different reviewer/,
      /limited number of times/,
      /never a dead end, with one exception/,
      /under 18 has no retry and closes the account at once/,
      /found to belong to a minor is closed/,
      /adults-only \(\+18\) stories, they are open only to verified accounts/,
      /revokes the verification/,
    ]) {
      expect(en).toMatch(clause);
    }
  });

  it('carries every age-verification clause into a required server, in Portuguese', () => {
    const pt = textOf(required.pt);
    for (const clause of [
      /18 anos ou mais/,
      /O cadastro fica pendente/,
      /Documento de outra pessoa não verifica ninguém/,
      /Recusa nunca é um beco sem saída/,
      /revisor diferente/,
      /número limitado de vezes/,
      /com uma exceção: a recusa por ser menor de 18 anos não tem nova tentativa e encerra a conta de imediato/,
      /descoberta como sendo de menor é encerrada/,
      /histórias \+18, elas são abertas somente a contas verificadas/,
      /revogar a verificação/,
    ]) {
      expect(pt).toMatch(clause);
    }
  });
});
