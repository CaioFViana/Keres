/** @jest-environment node */
import { renderHook } from '@testing-library/react-native';
import { useLanguageLabel } from '../../src/hooks/useLanguageLabel';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => `label:${key}` }),
}));

// The real module boots i18next with initReactI18next at import time, which cannot run under the
// mocked react-i18next above; mirror its option shape so the hook mapping stays meaningful.
jest.mock('../../src/utils/i18n', () => ({
  __esModule: true,
  getLanguageOptions: (t: (key: string) => string) => [
    { label: t('language_english'), value: 'en' },
    { label: t('language_portuguese'), value: 'pt' },
  ],
}));

describe('useLanguageLabel', () => {
  it('resolves known language codes to their localized labels', async () => {
    const hook = await renderHook(() => useLanguageLabel());
    expect(hook.result.current('en')).toBe('label:language_english');
    expect(hook.result.current('pt')).toBe('label:language_portuguese');
  });

  it('falls back to the code itself for unknown languages', async () => {
    const hook = await renderHook(() => useLanguageLabel());
    expect(hook.result.current('xx')).toBe('xx');
    expect(hook.result.current('')).toBe('');
  });
});
