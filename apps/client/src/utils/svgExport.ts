/**
 * Bits every standalone SVG export shares: escaping, rounding, the title block and the
 * document wrapper. The board and map exporters used to carry identical copies of these;
 * one copy keeps the files byte-identical where the surfaces do not deliberately differ
 * (header heights and minimum canvas sizes stay per surface - those are layout).
 */

export interface SvgExportColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  /** Theme accent: stamps without their own color, mirroring the screen default. */
  primary: string;
}

export function escapeSvgXml(value: string): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function roundSvg(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The title + subtitle lines every exported file opens with. */
export function svgExportTitleBlock(
  title: string,
  subtitle: string,
  colors: SvgExportColors,
): string {
  return [
    `<text x="24" y="28" font-size="20" font-weight="bold" fill="${colors.text}">${escapeSvgXml(title)}</text>`,
    `<text x="24" y="46" font-size="11" fill="${colors.textSecondary}">${escapeSvgXml(subtitle)}</text>`,
  ].join('\n');
}

export interface SvgExportDocument {
  width: number;
  height: number;
  title: string;
  /** Already-joined inner elements (background, title block, drawing group). */
  body: string;
}

/** Wraps the drawing in a standalone SVG document. */
export function svgExportDocument({ width, height, title, body }: SvgExportDocument): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${roundSvg(width)}" height="${roundSvg(height)}" viewBox="0 0 ${roundSvg(width)} ${roundSvg(height)}" font-family="Helvetica, Arial, sans-serif">`,
    `<title>${escapeSvgXml(title)}</title>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}
