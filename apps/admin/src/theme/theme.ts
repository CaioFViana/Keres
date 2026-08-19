export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'keres_admin_theme_preference';

export function readThemePreference(): ThemePreference {
  const raw = localStorage.getItem(THEME_PREFERENCE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

export function writeThemePreference(preference: ThemePreference): void {
  localStorage.setItem(THEME_PREFERENCE_KEY, preference);
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

export function themePreferenceLabel(preference: ThemePreference): string {
  if (preference === 'system') return 'Theme: System';
  if (preference === 'light') return 'Theme: Light';
  return 'Theme: Dark';
}
