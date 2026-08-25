/**
 * O cálculo e o desenho dos gráficos vivem em `@keres/shared/graphs`: são funções puras, sem
 * React Native, e o site (vitrine estática) precisa gerar os mesmos SVGs que o botão de
 * exportar do app produz. Reexportado aqui para `utils/storyGraphSvg` continuar sendo um caminho
 * válido dentro do app - mesmo arranjo de `theme/palettes`.
 */
export * from '@keres/shared/graphs/storyGraphSvg';
