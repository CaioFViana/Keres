import { describe, expect, it } from 'vitest';
import adminEn from '../../src/i18n/locales/admin.en.json';
import adminPt from '../../src/i18n/locales/admin.pt.json';
import showcaseEn from '../../src/i18n/locales/showcase.en.json';
import showcasePt from '../../src/i18n/locales/showcase.pt.json';
import { detectLanguage, LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '../../src/i18n';

/** Todas as chaves de um dicionário, achatadas em `a.b.c`. */
function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

/** Os marcadores `{{...}}` de um texto - eles precisam sobreviver à tradução. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();
}

function entries(dictionary: unknown, prefix = ''): Array<[string, string]> {
  if (typeof dictionary === 'string') {
    return [[prefix, dictionary]];
  }
  if (typeof dictionary !== 'object' || dictionary === null) {
    return [];
  }
  return Object.entries(dictionary).flatMap(([key, child]) =>
    entries(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe.each([
  ['admin', adminEn, adminPt],
  ['showcase', showcaseEn, showcasePt],
])('%s dictionary', (_name, english, portuguese) => {
  // Uma chave só em inglês cai no fallback e aparece em inglês no meio de uma tela em
  // português; uma chave só em português é texto morto que ninguém vê.
  it('has exactly the same keys in both languages', () => {
    expect(flatten(portuguese).sort()).toEqual(flatten(english).sort());
  });

  it('keeps the same interpolation placeholders in both languages', () => {
    const englishEntries = new Map(entries(english));
    for (const [key, translated] of entries(portuguese)) {
      expect({ key, placeholders: placeholders(translated) }).toEqual({
        key,
        placeholders: placeholders(englishEntries.get(key) ?? ''),
      });
    }
  });

  it('leaves no empty translation', () => {
    for (const [key, value] of entries(portuguese)) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  // Sem isto o seletor de idioma fica sem rótulo acessível numa das telas.
  it('names the language control', () => {
    expect(flatten(english)).toContain('language.label');
  });
});

describe('language detection', () => {
  it('offers a label for every supported language', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      expect(LANGUAGE_LABELS[language]).toBeTruthy();
    }
  });

  it('prefers what the person chose before', () => {
    localStorage.setItem('test_language', 'pt');
    expect(detectLanguage('test_language')).toBe('pt');
    localStorage.removeItem('test_language');
  });

  // `navigator.language` vem como `pt-BR`; o app não distingue variantes regionais.
  it('falls back to the browser language, ignoring the region', () => {
    const original = navigator.language;
    Object.defineProperty(navigator, 'language', { value: 'pt-BR', configurable: true });
    expect(detectLanguage('unset_language')).toBe('pt');

    Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
    expect(detectLanguage('unset_language')).toBe('en');

    Object.defineProperty(navigator, 'language', { value: original, configurable: true });
  });

  it('ignores a stored language it does not support', () => {
    localStorage.setItem('test_language', 'klingon');
    expect(SUPPORTED_LANGUAGES).toContain(detectLanguage('test_language'));
    localStorage.removeItem('test_language');
  });
});
