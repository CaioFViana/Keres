export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const SITE_THEME_KEY = 'keres_site_theme_preference';

export function readThemePreference(key: string = SITE_THEME_KEY): ThemePreference {
  const raw = localStorage.getItem(key);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

export function writeThemePreference(
  preference: ThemePreference,
  key: string = SITE_THEME_KEY,
): void {
  localStorage.setItem(key, preference);
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemPrefersDark() ? 'dark' : 'light';
}

export function cycleThemePreference(current: ThemePreference): ThemePreference {
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  return 'system';
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.setAttribute('data-theme', theme);
}
