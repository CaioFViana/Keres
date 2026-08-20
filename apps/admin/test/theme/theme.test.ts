import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_PREFERENCE_KEY,
  cycleThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from '../../src/theme/theme';

afterEach(() => {
  localStorage.removeItem(THEME_PREFERENCE_KEY);
  vi.restoreAllMocks();
});

describe('theme preference resolution', () => {
  it('defaults to system and cycles light → dark → system', () => {
    expect(readThemePreference()).toBe('system');
    expect(cycleThemePreference('system')).toBe('light');
    expect(cycleThemePreference('light')).toBe('dark');
    expect(cycleThemePreference('dark')).toBe('system');
  });

  it('resolves an explicit preference without consulting the OS', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('resolves system from prefers-color-scheme', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    expect(resolveTheme('system')).toBe('dark');

    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    expect(resolveTheme('system')).toBe('light');
  });

  it('persists preference in localStorage', () => {
    writeThemePreference('dark');
    expect(readThemePreference()).toBe('dark');
  });
});
