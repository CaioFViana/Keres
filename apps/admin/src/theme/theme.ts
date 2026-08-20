import { getContrastTextColor, themes, type ThemeColors } from '@keres/shared';

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

/** Tokens que podem ser copiados direto: cada um já é usado no seu próprio fundo. */
const PALETTE_TO_CSS_VAR: Array<[keyof ThemeColors, string]> = [
  ['primary', '--color-primary'],
  ['primaryVariant', '--color-primary-variant'],
  ['background', '--color-bg'],
  ['surface', '--color-surface'],
  ['card', '--color-card'],
  ['text', '--color-text'],
  ['textSecondary', '--color-text-secondary'],
  ['border', '--color-border'],
  ['error', '--color-error'],
  ['accent', '--color-accent'],
  ['primary', '--color-focus'],
];

/** Mistura duas cores hexadecimais; `amount` é quanto da segunda entra (0 a 1). */
function mixHexColors(base: string, blend: string, amount: number): string {
  const parse = (hex: string) => {
    const value = hex.replace('#', '');
    const full =
      value.length === 3
        ? value
            .split('')
            .map((character) => character + character)
            .join('')
        : value.slice(0, 6);
    return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16));
  };

  const [baseRed, baseGreen, baseBlue] = parse(base);
  const [blendRed, blendGreen, blendBlue] = parse(blend);
  const channel = (from: number, to: number) =>
    Math.round(from + (to - from) * amount)
      .toString(16)
      .padStart(2, '0');

  return `#${channel(baseRed, blendRed)}${channel(baseGreen, blendGreen)}${channel(baseBlue, blendBlue)}`;
}

/**
 * Cores derivadas, calculadas a partir do fundo em que cada uma vai ser desenhada.
 *
 * A barra lateral é o caso que obrigou isto: ela usa `primaryVariant` como fundo e antes usava
 * `onPrimary` como texto. Nas paletas do app esses dois tokens não são um par - `onPrimary`
 * acompanha `primary`, não `primaryVariant` - e em boa parte dos temas o resultado era texto
 * claro sobre fundo claro, ilegível. Aqui o texto sai da luminância do fundo real
 * (`getContrastTextColor`, a mesma função que o app usa), então qualquer paleta serve.
 */
function derivedPaletteVars(colors: ThemeColors): Array<[string, string]> {
  const sidebarBackground = colors.primaryVariant;
  const sidebarForeground =
    getContrastTextColor(sidebarBackground) === 'black' ? '#000000' : '#ffffff';

  return [
    ['--color-sidebar-bg', sidebarBackground],
    ['--color-sidebar-text', sidebarForeground],
    // Secundário e hover são o mesmo texto/fundo puxados um para o outro, em vez de tokens
    // separados: assim continuam legíveis em qualquer paleta, clara ou escura.
    ['--color-sidebar-muted', mixHexColors(sidebarForeground, sidebarBackground, 0.35)],
    ['--color-sidebar-hover', mixHexColors(sidebarBackground, sidebarForeground, 0.18)],
    // O texto sobre os botões primários segue a mesma regra, pelo mesmo motivo.
    [
      '--color-on-primary',
      getContrastTextColor(colors.primary) === 'black' ? '#000000' : '#ffffff',
    ],
    ['--color-row-hover', mixHexColors(colors.surface, colors.primary, 0.08)],
    ['--color-table-head', mixHexColors(colors.surface, colors.text, 0.05)],
    ['--color-pre-bg', mixHexColors(colors.surface, colors.text, 0.07)],
  ];
}

/** Todas as variáveis que uma paleta escreve - usada também para limpá-las. */
const MANAGED_CSS_VARS = [
  ...PALETTE_TO_CSS_VAR.map(([, cssVar]) => cssVar),
  '--color-sidebar-bg',
  '--color-sidebar-text',
  '--color-sidebar-muted',
  '--color-sidebar-hover',
  '--color-on-primary',
  '--color-row-hover',
  '--color-table-head',
  '--color-pre-bg',
];

export function applyPalette(name: string, mode: ResolvedTheme): void {
  const root = document.documentElement;
  for (const cssVar of MANAGED_CSS_VARS) {
    root.style.removeProperty(cssVar);
  }
  if (name === 'default' || !(name in themes)) {
    return;
  }
  const colors = mode === 'dark' ? themes[name].darkColors : themes[name].lightColors;
  for (const [token, cssVar] of PALETTE_TO_CSS_VAR) {
    root.style.setProperty(cssVar, colors[token]);
  }
  for (const [cssVar, value] of derivedPaletteVars(colors)) {
    root.style.setProperty(cssVar, value);
  }
}
