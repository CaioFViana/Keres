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

  it('is at the version that carries the age-verification flow', () => {
    expect(CLIENT_PRIVACY_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('files the age verification flow under section 7 in both languages, in step with each other', () => {
    expect(CLIENT_PRIVACY.en.find((s) => s.heading.startsWith('7.'))?.heading).toBe(
      '7. Age verification',
    );
    expect(CLIENT_PRIVACY.pt.find((s) => s.heading.startsWith('7.'))?.heading).toBe(
      '7. Verificação de idade',
    );
  });

  it('says the app collects no identity document and keeps no copy of the one sent to a server', () => {
    const section = (sections: typeof CLIENT_PRIVACY.en) =>
      (sections.find((s) => s.heading.startsWith('7.'))?.paragraphs ?? []).join(' ');

    const en = section(CLIENT_PRIVACY.en);
    expect(en).toMatch(/collects no identity document/);
    expect(en).toMatch(/go straight from the device to that server's verification service/);
    expect(en).toMatch(/No copy stays on the device or on Keres servers/);
    expect(en).toMatch(/governed by the privacy policy of that server, not by this one/);

    const pt = section(CLIENT_PRIVACY.pt);
    expect(pt).toMatch(/não coleta nenhum documento de identidade/);
    expect(pt).toMatch(/diretamente para o serviço de verificação daquele servidor/);
    expect(pt).toMatch(/Nenhuma cópia fica no dispositivo nem nos servidores da Keres/);
    expect(pt).toMatch(/regido pela política de privacidade daquele servidor, e não por esta/);
  });
});
