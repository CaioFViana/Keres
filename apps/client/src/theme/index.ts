export * from './commonStyles';
export * from './palettes'; // Export themes object and Theme type
export * from './ThemeColors'; // Export ThemeColors
export * from './ThemeContext'; // Contexto + `useTheme`, sem tocar em store/banco
/**
 * `ThemeProvider` fica **fora** deste barrel de propósito. Ele depende do store de tema, que
 * depende do serviço de configurações, que depende do banco - e como praticamente todo
 * componente importa `useTheme` daqui, reexportá-lo colocava drizzle e expo-sqlite no grafo de
 * qualquer cartão desenhado na tela. Quem monta a árvore (`App.tsx`) importa
 * `./theme/ThemeProvider` diretamente.
 */
