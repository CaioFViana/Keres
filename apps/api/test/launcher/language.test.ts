import { describe, expect, it } from 'vitest';
import { detectSystemLanguage } from '../../src/launcher/language';

describe('detectSystemLanguage', () => {
  it('maps Portuguese tags to pt', () => {
    expect(detectSystemLanguage({ LANG: 'pt-BR' }, 'en-US')).toBe('pt');
    expect(detectSystemLanguage({ LC_ALL: 'pt_PT.UTF-8' }, 'de-DE')).toBe('pt');
  });

  it('maps English tags to en', () => {
    expect(detectSystemLanguage({ LANG: 'en-GB' }, 'pt-BR')).toBe('en');
  });

  it('falls back to the Intl locale, then to English', () => {
    expect(detectSystemLanguage({}, 'pt-BR')).toBe('pt');
    expect(detectSystemLanguage({}, 'ja-JP')).toBe('en');
    expect(detectSystemLanguage({}, '')).toBe('en');
  });
});
