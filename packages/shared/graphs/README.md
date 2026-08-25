# graphs

Layout e desenho dos gráficos da história: `storyGraph`, `locationGraph`,
`characterRelationGraph`, `storyTimeline`, `statRadar`, `presenceMatrix` e `plotCoverage`.

Cada assunto tem um par: `*Layout.ts` calcula a geometria (puro, testável, sem cores) e
`*Svg.ts` transforma esse layout num SVG completo. O app usa o primeiro para desenhar na tela
com `react-native-svg` e o segundo no botão de exportar; o site usa os dois para gerar a vitrine
estática. É o que garante que a imagem exportada e a imagem da página sejam o mesmo desenho.

Importe cada módulo pelo caminho (`@keres/shared/graphs/presenceMatrixSvg`), sem barril: três
destes módulos exportam constantes de mesmo nome (`NODE_WIDTH`, `GRAPH_PADDING`) para desenhos
diferentes, e um barril tornaria essa colisão ambígua em vez de explícita.
