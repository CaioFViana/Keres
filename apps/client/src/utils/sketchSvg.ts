import {
  sketchFillPathData,
  sketchStrokeLineCap,
  sketchStrokePathData,
  type SketchDocument,
  type SketchItem,
} from '@keres/shared';
import { renderCanvasOverlaySvg } from './canvasOverlaySvg';
import { escapeSvgXml, roundSvg, svgExportDocument, type SvgExportColors } from './svgExport';

interface RenderSketchSvgOptions {
  title: string;
  colors: SvgExportColors;
  /** Paper fill, matching what the canvas shows (usually the theme surface). */
  paper: string;
}

function renderItem(item: SketchItem): string {
  if (item.kind === 'stroke') {
    const d = sketchStrokePathData(item.points);
    if (!d) return '';
    const alpha = item.alpha < 1 ? ` stroke-opacity="${roundSvg(item.alpha)}"` : '';
    return `<path d="${d}" fill="none" stroke="${escapeSvgXml(item.color)}"${alpha} stroke-width="${roundSvg(item.size)}" stroke-linecap="${sketchStrokeLineCap(item)}" stroke-linejoin="round"/>`;
  }
  const d = sketchFillPathData(item.rings);
  if (!d) return '';
  const alpha = item.alpha < 1 ? ` fill-opacity="${roundSvg(item.alpha)}"` : '';
  return `<path d="${d}" fill="${escapeSvgXml(item.color)}"${alpha} fill-rule="evenodd"/>`;
}

/**
 * A sketch as a standalone SVG: the page is the artboard (no title block inside it - the drawing
 * continues elsewhere, e.g. Krita, at exactly this size). Hidden layers are skipped, translucent
 * layers ride `<g opacity>` and a transparent page simply omits the paper rectangle. Strokes and
 * fills come out as the same path data the canvas draws, so file and screen agree.
 */
export function renderSketchSvg(doc: SketchDocument, options: RenderSketchSvgOptions): string {
  const { page, layers, overlays } = doc;
  const paper = page.background === 'white' ? '#ffffff' : options.paper;
  const body: string[] = [];
  if (page.background !== 'transparent') {
    body.push(
      `<rect x="0" y="0" width="${roundSvg(page.width)}" height="${roundSvg(page.height)}" fill="${escapeSvgXml(paper)}"/>`,
    );
  }
  for (const layer of layers) {
    if (!layer.visible || layer.items.length === 0) continue;
    const items = layer.items.map(renderItem).filter(Boolean).join('\n');
    if (!items) continue;
    body.push(
      layer.opacity < 1
        ? `<g opacity="${roundSvg(layer.opacity)}">\n${items}\n</g>`
        : `<g>\n${items}\n</g>`,
    );
  }
  const groups = renderCanvasOverlaySvg(overlays, {
    shift: (x, y) => ({ x, y }),
    colors: options.colors,
    stroke: options.colors.text,
  });
  body.push(...groups.vectors, ...groups.stamps);
  return svgExportDocument({
    width: page.width,
    height: page.height,
    title: options.title,
    body: body.join('\n'),
  });
}
