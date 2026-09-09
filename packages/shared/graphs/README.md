# graphs

Layout and drawing of the story graphs: `storyGraph`, `locationGraph`,
`characterRelationGraph`, `storyTimeline`, `statRadar`, `presenceMatrix` and `plotCoverage`.

Each subject has a pair: `*Layout.ts` computes the geometry (pure, testable, colourless) and
`*Svg.ts` turns that layout into a complete SVG. The client uses the first to draw on screen
with `react-native-svg` and the second in the export button. Sharing both modules keeps the
on-screen drawing and the exported image the same geometry.

Import each module by its path (`@keres/shared/graphs/presenceMatrixSvg`), with no barrel: three
of these modules export constants with the same name (`NODE_WIDTH`, `GRAPH_PADDING`) for
different drawings, and a barrel would make that collision ambiguous instead of explicit.
