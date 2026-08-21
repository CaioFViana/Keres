import { describe, expect, it } from 'vitest';
import {
  DOWNLOADS,
  FAQ_ITEMS,
  FEATURE_GROUPS,
  NAV_SECTIONS,
  PILLARS,
  PLATFORMS,
} from '../../src/content/catalog';
import { detectLanguage, initI18n, LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from '../../src/i18n';
import siteEn from '../../src/i18n/locales/site.en.json';
import sitePt from '../../src/i18n/locales/site.pt.json';

function flatten(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

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

const englishKeys = flatten(siteEn);

describe('site dictionary', () => {
  it('has exactly the same keys in both languages', () => {
    expect(flatten(sitePt).sort()).toEqual(englishKeys.sort());
  });

  it('keeps the same interpolation placeholders in both languages', () => {
    const englishEntries = new Map(entries(siteEn));
    for (const [key, translated] of entries(sitePt)) {
      expect({ key, placeholders: placeholders(translated) }).toEqual({
        key,
        placeholders: placeholders(englishEntries.get(key) ?? ''),
      });
    }
  });

  it('leaves no empty translation', () => {
    for (const [key, value] of entries(sitePt)) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('names the language control', () => {
    expect(englishKeys).toContain('language.label');
  });

  it('covers every catalog id', () => {
    for (const section of NAV_SECTIONS) {
      expect(englishKeys).toContain(`nav.${section}`);
    }
    for (const pillar of PILLARS) {
      expect(englishKeys).toContain(`pillars.${pillar}.title`);
    }
    for (const group of FEATURE_GROUPS) {
      expect(englishKeys).toContain(`features.${group.id}.title`);
      for (const item of group.items) {
        expect(englishKeys).toContain(`features.${group.id}.items.${item}.title`);
        expect(englishKeys).toContain(`features.${group.id}.items.${item}.body`);
      }
    }
    for (const platform of PLATFORMS) {
      expect(englishKeys).toContain(`platforms.items.${platform}.title`);
    }
    for (const item of DOWNLOADS) {
      expect(englishKeys).toContain(`download.items.${item}.cta`);
    }
    for (const item of FAQ_ITEMS) {
      expect(englishKeys).toContain(`faq.items.${item}.q`);
    }
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

  it('reuses the same i18n instance on a second init', () => {
    expect(initI18n()).toBe(initI18n());
  });
});
