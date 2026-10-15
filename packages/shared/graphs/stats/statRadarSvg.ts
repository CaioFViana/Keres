import type { StatRadarLayout } from './statRadarLayout';

/**
 * Serialises the radar as a complete SVG file - the same reasoning as the maps
 * (`characterRelationGraphSvg.ts`): the geometry arrives ready from `buildStatRadarLayout`, so the
 * screen and the exported file never disagree about where a vertex is.
 */

export interface StatRadarSvgOptions {
  title: string;
  /** Context line under the title (character and mode, or whatever is being compared). */
  subtitle: string;
  /** Legend per series; omitted when there is only one. */
  showLegend: boolean;
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
}

const PADDING = 24;
const HEADER_TOP = 30;
const LEGEND_ROW_HEIGHT = 20;

export function renderStatRadarSvg(layout: StatRadarLayout, options: StatRadarSvgOptions): string {
  const legendRows = options.showLegend ? layout.series.length : 0;
  const headerHeight = HEADER_TOP + 22;
  const legendHeight = legendRows > 0 ? legendRows * LEGEND_ROW_HEIGHT + 12 : 0;
  const width = layout.size;
  const height = headerHeight + layout.size + legendHeight;

  const body = [
    `<rect x="0" y="0" width="${width}" height="${round(height)}" fill="${options.colors.background}"/>`,
    `<text x="${PADDING}" y="${HEADER_TOP}" font-size="18" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="${PADDING}" y="${HEADER_TOP + 18}" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
    `<g transform="translate(0 ${round(headerHeight)})">`,
    // Rings and axes first: passing under the polygons keeps them from striking through the coloured areas.
    ...layout.rings.map((ring) => renderRing(ring, options)),
    ...layout.axes.map((axis) => renderAxis(axis, layout, options)),
    ...layout.series.map((series) => renderSeries(series)),
    '</g>',
    ...(legendRows > 0 ? [renderLegend(layout, options, headerHeight + layout.size)] : []),
  ].join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}" font-family="Helvetica, Arial, sans-serif">`,
    `<title>${escapeXml(options.title)}</title>`,
    body,
    '</svg>',
    '',
  ].join('\n');
}

function renderRing(ring: StatRadarLayout['rings'][number], options: StatRadarSvgOptions): string {
  const dash = ring.isOverflow ? ' stroke-dasharray="4 4"' : '';
  const fill = ring.isOverflow ? 'none' : options.colors.surface;
  const opacity = ring.isOverflow ? 1 : 0.35;
  return `<polygon points="${ring.points}" fill="${fill}" fill-opacity="${opacity}" stroke="${options.colors.border}" stroke-width="1"${dash}/>`;
}

function renderAxis(
  axis: StatRadarLayout['axes'][number],
  layout: StatRadarLayout,
  options: StatRadarSvgOptions,
): string {
  return [
    `<line x1="${layout.center.x}" y1="${layout.center.y}" x2="${axis.end.x}" y2="${axis.end.y}" stroke="${options.colors.border}" stroke-width="1"/>`,
    `<text x="${axis.labelPoint.x}" y="${round(axis.labelPoint.y + 4)}" font-size="11" text-anchor="${axis.textAnchor}" fill="${options.colors.text}">${escapeXml(axis.label)}</text>`,
  ].join('\n');
}

function renderSeries(series: StatRadarLayout['series'][number]): string {
  return [
    `<polygon points="${series.points}" fill="${series.color}" fill-opacity="0.22" stroke="${series.color}" stroke-width="2"/>`,
    ...series.vertices.map(
      (vertex) =>
        `<circle cx="${vertex.x}" cy="${vertex.y}" r="${vertex.isOverflow ? 5 : 3.5}" fill="${series.color}"/>`,
    ),
  ].join('\n');
}

function renderLegend(layout: StatRadarLayout, options: StatRadarSvgOptions, top: number): string {
  return layout.series
    .map((series, index) => {
      const y = top + 12 + index * LEGEND_ROW_HEIGHT;
      return [
        `<rect x="${PADDING}" y="${round(y - 9)}" width="12" height="12" rx="3" fill="${series.color}"/>`,
        `<text x="${PADDING + 18}" y="${round(y)}" font-size="11" fill="${options.colors.text}">${escapeXml(series.label)}</text>`,
      ].join('');
    })
    .join('\n');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
