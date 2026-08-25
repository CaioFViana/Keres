import type { PlotCoverageEntry } from './plotCoverageLayout';

export type { PlotCoverageEntry };

const PADDING = 24;
const ROW_HEIGHT = 54;
const HEADER_HEIGHT = 74;
const LEGEND_HEIGHT = 26;
const TRACK_HEIGHT = 12;
const WIDTH = 720;

/**
 * Plot coverage as SVG, in the same spirit as `presenceMatrixSvg`: what the screen shows, in a
 * file the person can take with them.
 *
 * Each bar is split by chapter, in narrative order - see `plotCoverageLayout`.
 */
export function renderPlotCoverageSvg(
  entries: PlotCoverageEntry[],
  options: {
    title: string;
    subtitle: string;
    average: string;
    background: string;
    surface: string;
    text: string;
    border: string;
    primary: string;
  },
): string {
  // The legend only exists if some bar has a chapter drawn in it.
  const legend = entries
    .flatMap((entry) => entry.segments)
    .reduce<{ name: string; color: string }[]>((unique, segment) => {
      if (!unique.some((item) => item.name === segment.chapterName))
        unique.push({ name: segment.chapterName, color: segment.color });
      return unique;
    }, []);

  const legendHeight = legend.length > 0 ? LEGEND_HEIGHT : 0;
  const height = HEADER_HEIGHT + legendHeight + entries.length * ROW_HEIGHT + PADDING;
  const trackWidth = WIDTH - PADDING * 2;
  const body: string[] = [
    `<rect width="${WIDTH}" height="${height}" fill="${options.background}"/>`,
    `<text x="${PADDING}" y="30" font-size="16" font-weight="bold" fill="${options.text}">${escapeXml(options.title)}</text>`,
    `<text x="${PADDING}" y="48" font-size="11" fill="${options.text}" fill-opacity="0.72">${escapeXml(options.subtitle)}</text>`,
    `<text x="${PADDING}" y="64" font-size="11" fill="${options.text}" fill-opacity="0.72">${escapeXml(options.average)}</text>`,
  ];

  let legendX = PADDING;
  for (const chapter of legend) {
    body.push(
      `<rect x="${legendX}" y="${HEADER_HEIGHT + 2}" width="9" height="9" rx="2" fill="${chapter.color}"/>`,
    );
    body.push(
      `<text x="${legendX + 14}" y="${HEADER_HEIGHT + 10}" font-size="10" fill="${options.text}" fill-opacity="0.72">${escapeXml(truncate(chapter.name, 24))}</text>`,
    );
    legendX += 24 + Math.min(chapter.name.length, 24) * 5.4;
  }

  entries.forEach((entry, index) => {
    const y = HEADER_HEIGHT + legendHeight + index * ROW_HEIGHT;
    body.push(
      `<text x="${PADDING}" y="${y + 14}" font-size="13" font-weight="bold" fill="${options.text}">${escapeXml(truncate(entry.name, 52))}</text>`,
    );
    body.push(
      `<text x="${WIDTH - PADDING}" y="${y + 14}" font-size="11" text-anchor="end" fill="${options.text}" fill-opacity="0.72">${entry.covered}/${entry.total} · ${entry.percentage}%</text>`,
    );
    body.push(
      `<rect x="${PADDING}" y="${y + 24}" width="${trackWidth}" height="${TRACK_HEIGHT}" rx="${TRACK_HEIGHT / 2}" fill="${options.surface}" stroke="${options.border}"/>`,
    );

    // The pieces are drawn flush against each other, left to right, in chapter order: the summed width
    // is the coverage, and the composition says where it comes from.
    let cursor = PADDING;
    entry.segments.forEach((segment, position) => {
      const width = (trackWidth * segment.percentage) / 100;
      if (width <= 0) return;
      const isFirst = position === 0;
      const isLast = position === entry.segments.length - 1;
      const radius = TRACK_HEIGHT / 2;
      // Only the bar's ends are rounded; joints in the middle stay square so the pieces look like a
      // continuous rail rather than loose pills.
      const shape =
        isFirst || isLast
          ? `<path d="${roundedSegment(cursor, y + 24, width, TRACK_HEIGHT, isFirst ? radius : 0, isLast ? radius : 0)}" fill="${segment.color}"/>`
          : `<rect x="${cursor}" y="${y + 24}" width="${width}" height="${TRACK_HEIGHT}" fill="${segment.color}"/>`;
      body.push(shape);
      cursor += width;
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="Helvetica, Arial, sans-serif"><title>${escapeXml(options.title)}</title><desc>${escapeXml(options.subtitle)}</desc>${body.join('')}</svg>`;
}

/** A rectangle with a radius only on the requested ends, so pieces can be joined with no visible seam. */
function roundedSegment(
  x: number,
  y: number,
  width: number,
  height: number,
  leftRadius: number,
  rightRadius: number,
): string {
  const left = Math.min(leftRadius, width / 2);
  const right = Math.min(rightRadius, width / 2);
  return [
    `M${x + left},${y}`,
    `H${x + width - right}`,
    right ? `A${right},${right} 0 0 1 ${x + width},${y + right}` : `V${y}`,
    `V${y + height - right}`,
    right ? `A${right},${right} 0 0 1 ${x + width - right},${y + height}` : '',
    `H${x + left}`,
    left ? `A${left},${left} 0 0 1 ${x},${y + height - left}` : '',
    `V${y + left}`,
    left ? `A${left},${left} 0 0 1 ${x + left},${y}` : '',
    'Z',
  ]
    .filter(Boolean)
    .join(' ');
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
