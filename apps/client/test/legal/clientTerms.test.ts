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

  it('is at the version that carries the current age rules', () => {
    expect(CLIENT_TERMS_VERSION).toBeGreaterThanOrEqual(1);
  });

  it('says the app does not verify age, keeps no identity document, and leaves verification to each server', () => {
    const ageText = (sections: typeof CLIENT_TERMS.en) =>
      (sections.find((s) => s.heading.startsWith('8.'))?.paragraphs ?? []).join(' ');

    const en = ageText(CLIENT_TERMS.en);
    for (const clause of [
      /does not verify your age/,
      /keeps no identity document/,
      /Minors are not allowed on servers by default/,
      /verification service/,
      /mark accounts as verified by other means/,
      /Each server answers for its own verification and its own rules/,
      /chooses, in its profile, whether it sees adults-only/,
    ]) {
      expect(en).toMatch(clause);
    }

    const pt = ageText(CLIENT_TERMS.pt);
    for (const clause of [
      /não verifica sua idade/,
      /não guarda nenhum documento de identidade/,
      /Menores não são permitidos nos servidores por padrão/,
      /marquem contas como verificadas|marque contas como verificadas por outros meios/,
      /Cada servidor responde pela sua verificação e pelas suas regras/,
      /escolhe, no perfil, se vê conteúdo adulto/,
    ]) {
      expect(pt).toMatch(clause);
    }
  });

  it('says the official server takes no payments and grants plans itself', () => {
    const plansText = (sections: typeof CLIENT_TERMS.en) =>
      (sections.find((s) => s.heading.startsWith('5.'))?.paragraphs ?? []).join(' ');

    expect(plansText(CLIENT_TERMS.en)).toMatch(/take no payments and grant plans themselves/);
    expect(plansText(CLIENT_TERMS.pt)).toMatch(/não recebem pagamentos e concedem os planos/);
  });

  it('points to the contact form on keres.me and names no email address', () => {
    const privacyText = (sections: typeof CLIENT_TERMS.en) =>
      (sections.find((s) => s.heading.startsWith('9.'))?.paragraphs ?? []).join(' ');

    expect(privacyText(CLIENT_TERMS.en)).toMatch(/contact form on keres\.me/);
    expect(privacyText(CLIENT_TERMS.pt)).toMatch(/formulário de contato em keres\.me/);
    for (const sections of [CLIENT_TERMS.en, CLIENT_TERMS.pt]) {
      const all = sections.flatMap((s) => [s.heading, ...s.paragraphs]).join('\n');
      expect(all).not.toMatch(/privacy@|@keres\.me/);
    }
  });
});
