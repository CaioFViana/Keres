import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/index';
import {
  PRIVACY_POLICY,
  PRIVACY_POLICY_VERSION,
  privacyPolicyDigest,
  privacyPolicyFor,
  type PrivacyPolicySection,
} from '../../src/legal/privacyPolicy';

describe('GET /api/keres-privacy', () => {
  it('serves the versioned privacy policy with no session', async () => {
    const app = await createApp();

    const response = await app.handle(new Request('http://localhost/api/keres-privacy'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      version: number;
      updatedAt: string;
      en: { heading: string; paragraphs: string[] }[];
      pt: { heading: string; paragraphs: string[] }[];
    };
    expect(body.version).toBe(PRIVACY_POLICY_VERSION);
    expect(typeof body.updatedAt).toBe('string');
    expect(body.en.length).toBe(body.pt.length);
    for (const language of [body.en, body.pt] as const) {
      expect(language.length).toBeGreaterThan(0);
      for (const section of language) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });
});

const required = privacyPolicyFor('required');
const manual = privacyPolicyFor('manual');
const NUMBERS = Array.from({ length: 11 }, (_, index) => String(index + 1));

const textOf = (sections: PrivacyPolicySection[]) =>
  sections.flatMap((section) => [section.heading, ...section.paragraphs]).join('\n');
const numberOf = (section: PrivacyPolicySection) => section.heading.split('.')[0];

describe('the server privacy policy by age-verification mode', () => {
  it('is versioned, at the version both modes share', () => {
    expect(PRIVACY_POLICY_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('keeps the same sections, in the same order, in both languages and in both modes', () => {
    for (const document of [required, manual]) {
      expect(document.en.map(numberOf)).toEqual(NUMBERS);
      expect(document.pt.map(numberOf)).toEqual(NUMBERS);
    }
  });

  it('files the age verification category under section 10 in both languages and modes', () => {
    for (const document of [required, manual]) {
      expect(document.en[9]?.heading).toBe('10. Age verification');
      expect(document.pt[9]?.heading).toBe('10. Verificação de idade');
    }
  });

  it('serves the required policy through the constant the route still reads', () => {
    expect(PRIVACY_POLICY).toEqual(required);
  });

  it('gives a manual server a different policy, and a different digest for the acceptances', () => {
    expect(textOf(manual.en)).not.toBe(textOf(required.en));
    expect(textOf(manual.pt)).not.toBe(textOf(required.pt));
    expect(privacyPolicyDigest('manual')).not.toBe(privacyPolicyDigest('required'));
    expect(privacyPolicyDigest()).toBe(privacyPolicyDigest('required'));
  });

  it('says that a manual server runs no verification service and collects no verification data', () => {
    const en = textOf(manual.en);
    for (const clause of [
      /runs no age-verification service and collects no verification data/,
      /marks the account as verified by hand/,
      /uses no payment provider/,
      /Minors are not allowed on this server by default/,
      /use the contact form on keres\.me/,
    ]) {
      expect(en).toMatch(clause);
    }
    const pt = textOf(manual.pt);
    for (const clause of [
      /não tem serviço de verificação de idade e não coleta dados de verificação/,
      /marca a conta como verificada à mão/,
      /não usa provedor de pagamento/,
      /Menores não são permitidos neste servidor por padrão/,
      /use o formulário de contato em keres\.me/,
    ]) {
      expect(pt).toMatch(clause);
    }
  });

  it('keeps every verification-only mechanism and payment provider out of a manual server', () => {
    expect(textOf(manual.en)).not.toMatch(
      /HMAC|governance record|Lei 15\.211|destroys them|Stripe|PayPal|Google Play|purchase-token|financial records/i,
    );
    expect(textOf(manual.pt)).not.toMatch(
      /HMAC|registro de governança|Lei 15\.211|apaga o documento|Stripe|PayPal|Google Play|token de compra|registros financeiros/i,
    );
  });

  it('names no email address in either mode: the contact form on keres.me is the way to ask', () => {
    for (const document of [required, manual]) {
      expect(textOf(document.en)).not.toMatch(/privacy@|@keres\.me/);
      expect(textOf(document.pt)).not.toMatch(/privacy@|@keres\.me/);
    }
  });

  it('states, for a required server, where the document goes, that it is destroyed, and what is kept', () => {
    const en = textOf(required.en);
    for (const clause of [
      /never by another server or operator/,
      /This server never receives the document/,
      /destroys them at the decision/,
      /no readable copy in any backup/,
      /HMAC commitment/,
      /reveals nothing about the document/,
      /pseudonymised proof of the verification/,
      /prescription period defined in the operator's governance record/,
      /keeps no document and no commitment/,
      /30-day window/,
      /Lei 15\.211\/2025, Art\. 13/,
      /never used to profile anyone \(Art\. 26\)/,
    ]) {
      expect(en).toMatch(clause);
    }
    const pt = textOf(required.pt);
    for (const clause of [
      /nunca por outro servidor ou operador/,
      /Este servidor nunca recebe o documento/,
      /apaga o documento na decisão/,
      /cópia legível em nenhum backup/,
      /compromisso HMAC/,
      /não revela nada sobre o documento/,
      /prova pseudonimizada da verificação/,
      /registro de governança do operador/,
      /não guarda documento nem compromisso/,
      /janela de 30 dias/,
      /Lei 15\.211\/2025, Art\. 13/,
      /nunca para perfilar alguém \(Art\. 26\)/,
    ]) {
      expect(pt).toMatch(clause);
    }
  });
});
