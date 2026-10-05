import type { SketchContentType } from '@keres/shared';
import { renderCanvasOverlaySvg } from './canvasOverlaySvg';
import { escapeSvgXml, roundSvg, svgExportDocument, type SvgExportColors } from './svgExport';

interface RenderSketchSvgOptions {
  title: string;
  colors: SvgExportColors;
  /** Paper fill, matching what the canvas shows (usually the theme surface). */
  paper: string;
}

/**
 * A sketch as a standalone SVG: the page is the artboard (no title block inside it -
 * the drawing continues elsewhere, e.g. Krita, at exactly this size), hidden layers
 * are skipped and translucent layers ride `<g opacity>`, mirroring the canvas.
 */
export function renderSketchSvg(
  content: SketchContentType,
  options: RenderSketchSvgOptions,
): string {
  const { page, layers, overlays } = content;
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  const visible = (overlays ?? []).filter((overlay) => {
    if (overlay.layerId === undefined) return true;
    return byId.get(overlay.layerId)?.visible !== false;
  });
  const groups = renderCanvasOverlaySvg(
    visible,
    {
      shift: (x, y) => ({ x, y }),
      colors: options.colors,
      stroke: options.colors.text,
    },
    (overlay) => {
      if (overlay.layerId === undefined) return 1;
      return byId.get(overlay.layerId)?.opacity ?? 1;
    },
  );
  const body = [
    `<rect x="0" y="0" width="${roundSvg(page.width)}" height="${roundSvg(page.height)}" fill="${escapeSvgXml(options.paper)}"/>`,
    ...groups.vectors,
    ...groups.stamps,
  ].join('\n');
  return svgExportDocument({ width: page.width, height: page.height, title: options.title, body });
}
