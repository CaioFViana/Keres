import {
  StoryTimelineLayout,
  TIMELINE_HEADER_HEIGHT,
  TIMELINE_LABEL_PADDING,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PADDING,
  TIMELINE_ROW_HEIGHT,
} from './storyTimelineLayout';

interface StoryTimelineSvgOptions {
  title: string;
  subtitle: string;
  labels: { gap: string; duration: string; compressed: string };
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
  };
}

export function renderStoryTimelineSvg(
  layout: StoryTimelineLayout,
  options: StoryTimelineSvgOptions,
) {
  const startY = TIMELINE_PADDING + TIMELINE_HEADER_HEIGHT;
  const body = [
    `<rect width="${layout.width}" height="${layout.height}" fill="${options.colors.background}"/>`,
    `<text x="${TIMELINE_PADDING}" y="28" font-size="18" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="${TIMELINE_PADDING}" y="47" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
    `<line x1="${TIMELINE_PADDING + TIMELINE_LABEL_WIDTH}" y1="${startY - 10}" x2="${layout.width - TIMELINE_PADDING}" y2="${startY - 10}" stroke="${options.colors.border}"/>`,
    `<line x1="${TIMELINE_PADDING}" y1="64" x2="${TIMELINE_PADDING + 20}" y2="64" stroke="${options.colors.textSecondary}" stroke-dasharray="4 3"/><text x="${TIMELINE_PADDING + 27}" y="68" font-size="10" fill="${options.colors.textSecondary}">${escapeXml(options.labels.gap)}</text>`,
    `<rect x="${TIMELINE_PADDING + 88}" y="59" width="18" height="10" rx="3" fill="${options.colors.textSecondary}"/><text x="${TIMELINE_PADDING + 113}" y="68" font-size="10" fill="${options.colors.textSecondary}">${escapeXml(options.labels.duration)}</text>`,
    `<text x="${TIMELINE_PADDING + 208}" y="68" font-size="10" fill="${options.colors.textSecondary}">⋯ ${escapeXml(options.labels.compressed)}</text>`,
  ];
  layout.rows.forEach((row, index) => {
    const y = startY + index * TIMELINE_ROW_HEIGHT;
    const centerY = y + TIMELINE_ROW_HEIGHT / 2;
    const barX = Math.min(row.barStart, row.barEnd);
    const barWidth = Math.max(4, Math.abs(row.barEnd - row.barStart));
    body.push(
      `<rect x="${TIMELINE_PADDING}" y="${y}" width="${layout.width - TIMELINE_PADDING * 2}" height="${TIMELINE_ROW_HEIGHT}" fill="${index % 2 ? options.colors.surface : options.colors.background}" stroke="${options.colors.border}" stroke-width="0.4"/>`,
      `<text x="${TIMELINE_PADDING + TIMELINE_LABEL_PADDING}" y="${centerY + 4}" font-size="11" font-weight="bold" fill="${row.chapterColor}">${row.sequence}. ${escapeXml(truncate(row.name, 25))}</text>`,
      `<text x="${TIMELINE_PADDING + TIMELINE_LABEL_WIDTH - 8}" y="${centerY + 4}" font-size="9" text-anchor="end" fill="${row.chapterColor}">${escapeXml(truncate(row.chapterName, 16))}</text>`,
      `<text x="${row.barStart}" y="${y + 13}" font-size="9" text-anchor="middle" fill="${options.colors.textSecondary}">${row.sequence}</text>`,
    );
    if (row.gapStart !== undefined && row.gapEnd !== undefined) {
      body.push(
        `<line x1="${row.gapStart}" y1="${centerY}" x2="${row.gapEnd}" y2="${centerY}" stroke="${row.chapterColor}" stroke-width="1.6" stroke-dasharray="5 4"/>`,
      );
    }
    body.push(
      `<rect x="${barX}" y="${centerY - 10}" width="${barWidth}" height="20" rx="5" fill="${row.chapterColor}" fill-opacity="0.82"/>`,
    );
    if (row.duration)
      body.push(
        `<text x="${barX + barWidth / 2}" y="${centerY + 4}" font-size="9" text-anchor="middle" fill="#fff">${escapeXml(row.duration.label)}</text>`,
      );
    if (row.gap)
      body.push(
        `<text x="${(row.gapStart! + row.gapEnd!) / 2}" y="${centerY - 13}" font-size="9" text-anchor="middle" fill="${options.colors.textSecondary}">${escapeXml(row.gap.label)}</text>`,
      );
  });
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" font-family="Helvetica, Arial, sans-serif"><title>${escapeXml(options.title)}</title>${body.join('')}</svg>`;
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
function escapeXml(value: string) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
