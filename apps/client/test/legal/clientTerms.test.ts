/** @jest-environment node */
import {
  CLIENT_TERMS_VERSION,
  CLIENT_TERMS,
  clientTermsFor,
} from '../../src/legal/clientTerms';

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
});
