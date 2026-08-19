import { themes, type ThemeColors } from '@keres/shared';

/**
 * Ponte entre as paletas do app (objetos de tokens, feitos para `StyleSheet` do React Native)
 * e o CSS do site (custom properties).
 *
 * A tradução existe para a página de uma história poder ser pintada com a paleta que o autor
 * escolheu para ela dentro do Keres - é o mesmo `stories.theme`, agora que as paletas moram em
 * `@keres/shared` e não mais só no cliente.
 */

/** Prefixo próprio: não colide com as variáveis do painel admin, que têm outra origem. */
const VAR_PREFIX = '--story';

const TOKEN_TO_VAR: Array<[keyof ThemeColors, string]> = [
  ['primary', 'primary'],
  ['primaryVariant', 'primary-variant'],
  ['primaryContainer', 'primary-container'],
  ['onPrimaryContainer', 'on-primary-container'],
  ['secondary', 'secondary'],
  ['background', 'bg'],
  ['surface', 'surface'],
  ['card', 'card'],
  ['text', 'text'],
  ['textSecondary', 'text-secondary'],
  ['border', 'border'],
  ['accent', 'accent'],
  ['star', 'star'],
  ['onPrimary', 'on-primary'],
  ['error', 'error'],
];

export function paletteExists(themeName: string | null | undefined): boolean {
  return !!themeName && themeName in themes;
}

/**
 * As variáveis CSS de uma paleta, no modo claro ou escuro. Cai no tema `default` quando a
 * história não tem tema, ou tem um que este build não conhece (pacote publicado por uma
 * versão mais nova do app).
 */
export function paletteVars(
  themeName: string | null | undefined,
  mode: 'light' | 'dark',
): Record<string, string> {
  const palette = (themeName && themes[themeName]) || themes.default;
  const colors = mode === 'dark' ? palette.darkColors : palette.lightColors;

  return Object.fromEntries(
    TOKEN_TO_VAR.map(([token, name]) => [`${VAR_PREFIX}-${name}`, colors[token]]),
  );
}

/** Nome de exibição de uma paleta, a partir da chave técnica (`seaOfStars` -> `Sea Of Stars`). */
export function paletteDisplayName(themeName: string | null | undefined): string {
  if (!paletteExists(themeName)) {
    return 'Default';
  }
  return themeName!
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}
