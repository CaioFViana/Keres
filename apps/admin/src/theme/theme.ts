import { themes, type ThemeColors } from '@keres/shared';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'keres_admin_theme_preference';
/** Paleta escolhida no painel. Vazio/ausente = a paleta `default`, que é o visual histórico. */
export const THEME_PALETTE_KEY = 'keres_admin_theme_palette';

/**
 * `key` existe porque o site público (apps/admin/src/showcase) usa exatamente esta mecânica
 * com uma chave própria - painel e site são coisas separadas e cada um lembra da sua escolha.
 */
export function readThemePreference(key: string = THEME_PREFERENCE_KEY): ThemePreference {
  const raw = localStorage.getItem(key);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

export function writeThemePreference(
  preference: ThemePreference,
  key: string = THEME_PREFERENCE_KEY,
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

export function themePreferenceLabel(preference: ThemePreference): string {
  if (preference === 'system') return 'Theme: System';
  if (preference === 'light') return 'Theme: Light';
  return 'Theme: Dark';
}

/**
 * Paleta do painel.
 *
 * As cores em `styles.css` sempre foram uma cópia manual da paleta `default` do app. Agora que
 * as paletas moram em `@keres/shared`, o painel pode usar qualquer uma delas: escolher uma
 * sobrescreve as variáveis em `<html>`, e "default" simplesmente remove as sobrescritas,
 * deixando o CSS original valer - por isso nada muda de aparência até alguém escolher.
 */
export const PALETTE_NAMES = Object.keys(themes);

export function readPaletteName(): string {
  const raw = localStorage.getItem(THEME_PALETTE_KEY);
  return raw && raw in themes ? raw : 'default';
}

export function writePaletteName(name: string): void {
  localStorage.setItem(THEME_PALETTE_KEY, name);
}

export function paletteLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}

/** Tokens da paleta -> as variáveis que `styles.css` já consome. */
const PALETTE_TO_CSS_VAR: Array<[keyof ThemeColors, string]> = [
  ['primary', '--color-primary'],
  ['primaryVariant', '--color-primary-variant'],
  ['onPrimary', '--color-on-primary'],
  ['background', '--color-bg'],
  ['surface', '--color-surface'],
  ['card', '--color-card'],
  ['text', '--color-text'],
  ['textSecondary', '--color-text-secondary'],
  ['border', '--color-border'],
  ['error', '--color-error'],
  ['accent', '--color-accent'],
  ['primaryVariant', '--color-sidebar-bg'],
  ['onPrimary', '--color-sidebar-text'],
  ['accent', '--color-focus'],
];

export function applyPalette(name: string, mode: ResolvedTheme): void {
  const root = document.documentElement;
  for (const [, cssVar] of PALETTE_TO_CSS_VAR) {
    root.style.removeProperty(cssVar);
  }
  if (name === 'default' || !(name in themes)) {
    return;
  }
  const colors = mode === 'dark' ? themes[name].darkColors : themes[name].lightColors;
  for (const [token, cssVar] of PALETTE_TO_CSS_VAR) {
    root.style.setProperty(cssVar, colors[token]);
  }
}
