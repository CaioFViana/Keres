export interface PlotCoverageEntry {
  name: string;
  covered: number;
  total: number;
  percentage: number;
}

const PADDING = 24;
const ROW_HEIGHT = 54;
const HEADER_HEIGHT = 74;
const TRACK_HEIGHT = 12;
const WIDTH = 720;

/**
 * A cobertura das tramas como SVG, no mesmo espírito de `presenceMatrixSvg`: o que a tela
 * mostra, num arquivo que a pessoa pode levar embora.
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
  const height = HEADER_HEIGHT + entries.length * ROW_HEIGHT + PADDING;
  const trackWidth = WIDTH - PADDING * 2;
  const body: string[] = [
    `<rect width="${WIDTH}" height="${height}" fill="${options.background}"/>`,
    `<text x="${PADDING}" y="30" font-size="16" font-weight="bold" fill="${options.text}">${escapeXml(options.title)}</text>`,
    `<text x="${PADDING}" y="48" font-size="11" fill="${options.text}" fill-opacity="0.72">${escapeXml(options.subtitle)}</text>`,
    `<text x="${PADDING}" y="64" font-size="11" fill="${options.text}" fill-opacity="0.72">${escapeXml(options.average)}</text>`,
  ];
  entries.forEach((entry, index) => {
    const y = HEADER_HEIGHT + index * ROW_HEIGHT;
    body.push(
      `<text x="${PADDING}" y="${y + 14}" font-size="13" font-weight="bold" fill="${options.text}">${escapeXml(truncate(entry.name, 52))}</text>`,
    );
    body.push(
      `<text x="${WIDTH - PADDING}" y="${y + 14}" font-size="11" text-anchor="end" fill="${options.text}" fill-opacity="0.72">${entry.covered}/${entry.total} · ${entry.percentage}%</text>`,
    );
    body.push(
      `<rect x="${PADDING}" y="${y + 24}" width="${trackWidth}" height="${TRACK_HEIGHT}" rx="${TRACK_HEIGHT / 2}" fill="${options.surface}" stroke="${options.border}"/>`,
    );
    if (entry.percentage > 0)
      body.push(
        `<rect x="${PADDING}" y="${y + 24}" width="${(trackWidth * entry.percentage) / 100}" height="${TRACK_HEIGHT}" rx="${TRACK_HEIGHT / 2}" fill="${options.primary}"/>`,
      );
  });
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="Helvetica, Arial, sans-serif"><title>${escapeXml(options.title)}</title><desc>${escapeXml(options.subtitle)}</desc>${body.join('')}</svg>`;
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
