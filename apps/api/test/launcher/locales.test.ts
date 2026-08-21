import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../src/launcher/i18n';
import { en, pt } from '../../src/launcher/locales';

describe('launcher locales', () => {
  it('has the same keys in English and Portuguese', () => {
    expect(Object.keys(pt).sort()).toEqual(Object.keys(en).sort());
  });

  it('falls back to English and interpolates', () => {
    const t = createTranslator('pt');
    expect(t('listening', { url: 'http://127.0.0.1:3000' })).toContain('http://127.0.0.1:3000');
  });
});
