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
const disabled = privacyPolicyFor('disabled');
const NUMBERS = Array.from({ length: 11 }, (_, index) => String(index + 1));

const textOf = (sections: PrivacyPolicySection[]) =>
  sections.flatMap((section) => [section.heading, ...section.paragraphs]).join('\n');
const numberOf = (section: PrivacyPolicySection) => section.heading.split('.')[0];

describe('the server privacy policy by age-verification mode', () => {
  it('bumps the version past the one clients may have accepted', () => {
    expect(PRIVACY_POLICY_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('keeps the same sections, in the same order, in both languages and in both modes', () => {
    for (const document of [required, disabled]) {
      expect(document.en.map(numberOf)).toEqual(NUMBERS);
      expect(document.pt.map(numberOf)).toEqual(NUMBERS);
    }
  });

  it('files the age verification category under section 10 in both languages and modes', () => {
    for (const document of [required, disabled]) {
      expect(document.en[9]?.heading).toBe('10. Age verification');
      expect(document.pt[9]?.heading).toBe('10. Verificação de idade');
    }
  });

  it('serves the required policy through the constant the route still reads', () => {
    expect(PRIVACY_POLICY).toEqual(required);
  });

  it('gives a disabled server a different policy, and a different digest for the acceptances', () => {
    expect(textOf(disabled.en)).not.toBe(textOf(required.en));
    expect(textOf(disabled.pt)).not.toBe(textOf(required.pt));
    expect(privacyPolicyDigest('disabled')).not.toBe(privacyPolicyDigest('required'));
    expect(privacyPolicyDigest()).toBe(privacyPolicyDigest('required'));
  });

  it('says that a disabled server collects no verification data', () => {
    expect(textOf(disabled.en)).toMatch(/No age verification on this server/);
    expect(textOf(disabled.en)).toMatch(/No verification data is collected on this server/);
    expect(textOf(disabled.pt)).toMatch(/Sem verificação de idade neste servidor/);
    expect(textOf(disabled.pt)).toMatch(/Nenhum dado de verificação é coletado neste servidor/);
  });

  it('keeps every verification-only mechanism out of a disabled server', () => {
    expect(textOf(disabled.en)).not.toMatch(/HMAC|governance record|Lei 15\.211|destroys them/);
    expect(textOf(disabled.pt)).not.toMatch(
      /HMAC|registro de governança|Lei 15\.211|apaga o documento/,
    );
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
