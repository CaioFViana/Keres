import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SITE_THEME_KEY,
  applyResolvedTheme,
  cycleThemePreference,
  readThemePreference,
  resolveTheme,
  systemPrefersDark,
  writeThemePreference,
} from '../../src/theme/theme';

afterEach(() => {
  localStorage.removeItem(SITE_THEME_KEY);
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
    expect(systemPrefersDark()).toBe(true);

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

  it('treats a missing matchMedia as light', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(systemPrefersDark()).toBe(false);
  });

  it('persists preference in localStorage', () => {
    writeThemePreference('dark');
    expect(readThemePreference()).toBe('dark');
  });

  it('writes the resolved theme onto the document', () => {
    applyResolvedTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
