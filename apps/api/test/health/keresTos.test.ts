import { describe, expect, it } from 'vitest';
import { createApp } from '@/index';
import {
  SERVER_TERMS,
  SERVER_TERMS_VERSION,
  serverTermsDigest,
  serverTermsFor,
  type ServerTermsSection,
} from '@/legal/serverTerms';

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
const manual = serverTermsFor('manual');
const NUMBERS = Array.from({ length: 11 }, (_, index) => String(index + 1));

const textOf = (sections: ServerTermsSection[]) =>
  sections.flatMap((section) => [section.heading, ...section.paragraphs]).join('\n');
const numberOf = (section: ServerTermsSection) => section.heading.split('.')[0];

describe('the server terms by age-verification mode', () => {
  it('is versioned, at the version both modes share', () => {
    expect(SERVER_TERMS_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('keeps the same sections, in the same order, in both languages and in both modes', () => {
    for (const document of [required, manual]) {
      expect(document.en.map(numberOf)).toEqual(NUMBERS);
      expect(document.pt.map(numberOf)).toEqual(NUMBERS);
    }
  });

  it('serves the required text through the constant the route still reads', () => {
    expect(SERVER_TERMS).toEqual(required);
  });

  it('gives a manual server a different text, and a different digest for the acceptances', () => {
    expect(textOf(manual.en)).not.toBe(textOf(required.en));
    expect(textOf(manual.pt)).not.toBe(textOf(required.pt));
    expect(serverTermsDigest('manual')).not.toBe(serverTermsDigest('required'));
    expect(serverTermsDigest()).toBe(serverTermsDigest('required'));
  });

  it('states plainly that a manual server admits no minors, starts every account unverified and takes no payments', () => {
    const en = textOf(manual.en);
    for (const clause of [
      /Minors are not allowed on this server by default/,
      /every account starts unverified/,
      /marks the account as verified by hand/,
      /takes no payments/,
      /nothing to refund/,
      /turn it on or off at any time in its profile/,
      /Marking a story \+18 on your own device is always possible/,
    ]) {
      expect(en).toMatch(clause);
    }
    const pt = textOf(manual.pt);
    for (const clause of [
      /Menores não são permitidos neste servidor por padrão/,
      /toda conta começa não verificada/,
      /marca a conta como verificada à mão/,
      /não recebe pagamentos/,
      /não há o que reembolsar/,
      /ligar ou desligar isso a qualquer momento no perfil/,
      /Marcar uma história como \+18 no seu próprio aparelho é sempre possível/,
    ]) {
      expect(pt).toMatch(clause);
    }
  });

  it('leaves out, in a manual server, every clause that presupposes a verification', () => {
    expect(textOf(manual.en)).not.toMatch(/becomes active|only after|pending|is approved|revok/i);
    expect(textOf(manual.pt)).not.toMatch(/fica ativa|pendente|depois que a verificação|revog/i);
  });

  it('leaves out, in a manual server, the refund and payment-provider wording', () => {
    expect(textOf(manual.en)).not.toMatch(
      /refund policy|Consumer Defense Code|Stripe|PayPal|Financial records/i,
    );
    expect(textOf(manual.pt)).not.toMatch(
      /política de reembolso|Código de Defesa do Consumidor|Stripe|PayPal|Registros financeiros/i,
    );
  });

  it('names no email address in either mode: the contact form on keres.me is the way to ask', () => {
    for (const document of [required, manual]) {
      expect(textOf(document.en)).not.toMatch(/privacy@|@keres\.me/);
      expect(textOf(document.pt)).not.toMatch(/privacy@|@keres\.me/);
    }
  });

  it('keeps the manual-only statements out of a required server', () => {
    const en = textOf(required.en);
    expect(en).not.toMatch(/no age verification/i);
    expect(en).not.toMatch(/Minors are not allowed on this server by default/);
    expect(en).not.toMatch(/marks the account as verified by hand/);
    const pt = textOf(required.pt);
    expect(pt).not.toMatch(/sem verificação de idade/i);
    expect(pt).not.toMatch(/Menores não são permitidos neste servidor por padrão/);
    expect(pt).not.toMatch(/marca a conta como verificada à mão/);
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
