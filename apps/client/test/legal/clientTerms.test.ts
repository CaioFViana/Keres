/** @jest-environment node */
import { CLIENT_TERMS_VERSION, CLIENT_TERMS, clientTermsFor } from '../../src/legal/clientTerms';

/**
 * The app's terms ship in the bundle in both languages: a missing or lopsided copy would ask
 * agreement to text one language never shows.
 */
describe('the client terms', () => {
  it('is versioned', () => {
    expect(Number.isInteger(CLIENT_TERMS_VERSION)).toBe(true);
    expect(CLIENT_TERMS_VERSION).toBeGreaterThan(0);
  });

  it('says the same in both languages', () => {
    const headings = (language: 'en' | 'pt') => CLIENT_TERMS[language].map((s) => s.heading);
    expect(headings('pt')).toHaveLength(headings('en').length);
    for (const sections of [CLIENT_TERMS.en, CLIENT_TERMS.pt] as const) {
      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(section.paragraphs.length).toBeGreaterThan(0);
      }
    }
  });

  it('follows the language on show, English by default', () => {
    expect(clientTermsFor('pt-BR')).toBe(CLIENT_TERMS.pt);
    expect(clientTermsFor('en')).toBe(CLIENT_TERMS.en);
    expect(clientTermsFor(undefined)).toBe(CLIENT_TERMS.en);
  });

  it('is at the version that carries the age-verification rules', () => {
    expect(CLIENT_TERMS_VERSION).toBeGreaterThanOrEqual(3);
  });

  it('says the app does not verify age, keeps no identity document, and leaves verification to each server', () => {
    const ageText = (sections: typeof CLIENT_TERMS.en) =>
      (sections.find((s) => s.heading.startsWith('8.'))?.paragraphs ?? []).join(' ');

    const en = ageText(CLIENT_TERMS.en);
    expect(en).toMatch(/does not verify your age/);
    expect(en).toMatch(/keeps no identity document/);
    expect(en).toMatch(/may require its own age verification before the account is activated/);
    expect(en).toMatch(/Each server answers for its own verification and its own rules/);
    expect(en).toMatch(/a server without verification offers no adults-only \(\+18\) area/);

    const pt = ageText(CLIENT_TERMS.pt);
    expect(pt).toMatch(/não verifica sua idade/);
    expect(pt).toMatch(/não guarda nenhum documento de identidade/);
    expect(pt).toMatch(/antes de ativar a conta/);
    expect(pt).toMatch(/Cada servidor responde pela sua verificação e pelas suas regras/);
    expect(pt).toMatch(/um servidor sem verificação não oferece área adulta/);
  });
});
