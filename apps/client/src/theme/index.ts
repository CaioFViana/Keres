export * from './commonStyles';
// The colour palette and type come from `@keres/shared` - the admin panel and the landing use the same
// colours. A named re-export, and not `export *`: the barrel over there brings in the whole zod schemas,
// and practically every component imports `useTheme` from here.
export { themeDisplayOptions, themes } from '@keres/shared';
export type { Theme, ThemeColors } from '@keres/shared';
export * from './ThemeContext'; // Contexto + `useTheme`, sem tocar em store/banco
/**
 * `ThemeProvider` deliberately stays **outside** this barrel. It depends on the theme store, which
 * depends on the settings service, which depends on the database - and since practically every
 * component imports `useTheme` from here, re-exporting it put drizzle and expo-sqlite in the graph of
 * any card drawn on the screen. Whoever assembles the tree (`App.tsx`) imports
 * `./theme/ThemeProvider` directly.
 */
