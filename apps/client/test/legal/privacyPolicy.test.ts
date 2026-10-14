/** @jest-environment node */
import {
  CLIENT_PRIVACY_VERSION,
  CLIENT_PRIVACY,
  clientPrivacyFor,
} from '../../src/legal/privacyPolicy';

/**
 * The app's privacy policy ships in the bundle in both languages: a missing or lopsided
 * copy would present a policy one language never shows.
 */
describe('the client privacy policy', () => {
  it('is versioned', () => {
    expect(Number.isInteger(CLIENT_PRIVACY_VERSION)).toBe(true);
    expect(CLIENT_PRIVACY_VERSION).toBeGreaterThan(0);
  });

  it('says the same in both languages', () => {
    const headings = (language: 'en' | 'pt') => CLIENT_PRIVACY[language].map((s) => s.heading);
    expect(headings('pt')).toHaveLength(headings('en').length);
    for (const sections of [CLIENT_PRIVACY.en, CLIENT_PRIVACY.pt] as const) {
      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });

  it('follows the language on show, English by default', () => {
    expect(clientPrivacyFor('pt-BR')).toBe(CLIENT_PRIVACY.pt);
    expect(clientPrivacyFor('en')).toBe(CLIENT_PRIVACY.en);
    expect(clientPrivacyFor(undefined)).toBe(CLIENT_PRIVACY.en);
  });

  it('is at the version that carries the current age-verification flow', () => {
    expect(CLIENT_PRIVACY_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('files the age verification flow under section 7 in both languages, in step with each other', () => {
    expect(CLIENT_PRIVACY.en.find((s) => s.heading.startsWith('7.'))?.heading).toBe(
      '7. Age verification',
    );
    expect(CLIENT_PRIVACY.pt.find((s) => s.heading.startsWith('7.'))?.heading).toBe(
      '7. Verificação de idade',
    );
  });

  it('says the app collects no identity document, keeps no copy of the one sent to a server, and lets an administrator verify instead', () => {
    const section = (sections: typeof CLIENT_PRIVACY.en) =>
      (sections.find((s) => s.heading.startsWith('7.'))?.paragraphs ?? []).join(' ');

    const en = section(CLIENT_PRIVACY.en);
    for (const clause of [
      /collects no identity document/,
      /go straight from the device to that server's verification service/,
      /No copy stays on the device or on Keres servers/,
      /governed by the privacy policy of that server, not by this one/,
      /leave verification to an administrator/,
    ]) {
      expect(en).toMatch(clause);
    }

    const pt = section(CLIENT_PRIVACY.pt);
    for (const clause of [
      /não coleta nenhum documento de identidade/,
      /diretamente para o serviço de verificação daquele servidor/,
      /Nenhuma cópia fica no dispositivo nem nos servidores da Keres/,
      /regido pela política de privacidade daquele servidor, e não por esta/,
      /deixar a verificação a cargo de um administrador/,
    ]) {
      expect(pt).toMatch(clause);
    }
  });

  it('points to the contact form on keres.me and names no email address', () => {
    const rights = (sections: typeof CLIENT_PRIVACY.en) =>
      (sections.find((s) => s.heading.startsWith('5.'))?.paragraphs ?? []).join(' ');

    expect(rights(CLIENT_PRIVACY.en)).toMatch(/contact form on keres\.me/);
    expect(rights(CLIENT_PRIVACY.pt)).toMatch(/formulário de contato em keres\.me/);
    for (const sections of [CLIENT_PRIVACY.en, CLIENT_PRIVACY.pt]) {
      const all = sections.flatMap((s) => [s.heading, ...s.paragraphs]).join('\n');
      expect(all).not.toMatch(/privacy@|@keres\.me/);
    }
  });
});
