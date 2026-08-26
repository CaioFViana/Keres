# graphs

Layout and drawing of the story graphs: `storyGraph`, `locationGraph`,
`characterRelationGraph`, `storyTimeline`, `statRadar`, `presenceMatrix` and `plotCoverage`.

Each subject has a pair: `*Layout.ts` computes the geometry (pure, testable, colourless) and
`*Svg.ts` turns that layout into a complete SVG. The app uses the first to draw on screen
with `react-native-svg` and the second in the export button; the site uses both to generate the
static showcase. It is what guarantees the exported image and the page's image are the same drawing.

Import each module by its path (`@keres/shared/graphs/presenceMatrixSvg`), with no barrel: three
of these modules export constants with the same name (`NODE_WIDTH`, `GRAPH_PADDING`) for
different drawings, and a barrel would make that collision ambiguous instead of explicit.
