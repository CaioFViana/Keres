export * from './commonStyles';
// Paleta e tipo das cores vêm de `@keres/shared` - o painel admin e a landing usam as mesmas
// cores. Reexportação nominal, e não `export *`: o barril de lá traz os schemas zod inteiros,
// e praticamente todo componente importa `useTheme` daqui.
export { themeDisplayOptions, themes } from '@keres/shared';
export type { Theme, ThemeColors } from '@keres/shared';
export * from './ThemeContext'; // Contexto + `useTheme`, sem tocar em store/banco
/**
 * `ThemeProvider` fica **fora** deste barrel de propósito. Ele depende do store de tema, que
 * depende do serviço de configurações, que depende do banco - e como praticamente todo
 * componente importa `useTheme` daqui, reexportá-lo colocava drizzle e expo-sqlite no grafo de
 * qualquer cartão desenhado na tela. Quem monta a árvore (`App.tsx`) importa
 * `./theme/ThemeProvider` diretamente.
 */
