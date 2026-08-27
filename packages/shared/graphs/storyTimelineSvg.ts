import type { StoryTimelineLayout } from './storyTimelineLayout';
import {
  TIMELINE_EVENT_LANE_HEIGHT,
  TIMELINE_LABEL_PADDING,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_PADDING,
  TIMELINE_ROW_HEIGHT,
} from './storyTimelineLayout';

interface StoryTimelineSvgOptions {
  title: string;
  subtitle: string;
  labels: { gap: string; duration: string; compressed: string; unanchored?: string };
  storyDuration: { title: string; value: string };
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
  // The bands occupy their own strip between the header and the first scene row.
  const bandsY = TIMELINE_PADDING + layout.headerHeight;
  const startY = bandsY + layout.eventLaneCount * TIMELINE_EVENT_LANE_HEIGHT;
  const body = [
    `<rect width="${layout.width}" height="${layout.height}" fill="${options.colors.background}"/>`,
    `<text x="${TIMELINE_PADDING}" y="28" font-size="18" font-weight="bold" fill="${options.colors.text}">${escapeXml(options.title)}</text>`,
    `<text x="${TIMELINE_PADDING}" y="47" font-size="11" fill="${options.colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
    `<line x1="${TIMELINE_PADDING}" y1="64" x2="${TIMELINE_PADDING + 20}" y2="64" stroke="${options.colors.textSecondary}" stroke-dasharray="4 3"/><text x="${TIMELINE_PADDING + 27}" y="68" font-size="10" fill="${options.colors.textSecondary}">${escapeXml(options.labels.gap)}</text>`,
    `<rect x="${TIMELINE_PADDING + 88}" y="59" width="18" height="10" rx="3" fill="${options.colors.textSecondary}"/><text x="${TIMELINE_PADDING + 113}" y="68" font-size="10" fill="${options.colors.textSecondary}">${escapeXml(options.labels.duration)}</text>`,
    `<text x="${TIMELINE_PADDING + 208}" y="68" font-size="10" fill="${options.colors.textSecondary}">⋯ ${escapeXml(options.labels.compressed)}</text>`,
  ];
  const headerBaseY = bandsY;
  if (layout.scaleMode === 'proportional') {
    body.push(
      `<line x1="${TIMELINE_PADDING + TIMELINE_LABEL_WIDTH}" y1="${headerBaseY - 10}" x2="${layout.width - TIMELINE_PADDING}" y2="${headerBaseY - 10}" stroke="${options.colors.border}"/>`,
    );
    layout.rulerTicks.forEach((tick) =>
      body.push(
        `<line x1="${tick.x}" y1="${headerBaseY - 15}" x2="${tick.x}" y2="${headerBaseY - 5}" stroke="${options.colors.textSecondary}"/>`,
        `<text x="${tick.x}" y="${headerBaseY - 20}" font-size="10" text-anchor="middle" fill="${options.colors.textSecondary}">${escapeXml(tick.label)}</text>`,
      ),
    );
  } else {
    body.push(
      // Below the legend, never on top of it: with few chapters the line rose to the header's 68px footer
      // and the two sentences overlapped.
      `<text x="${TIMELINE_PADDING + TIMELINE_LABEL_PADDING}" y="${Math.max(86, headerBaseY - 20 - layout.chapterLaneCount * 18)}" font-size="10" fill="${options.colors.textSecondary}">${escapeXml(options.storyDuration.title)}${options.storyDuration.value ? `: ${escapeXml(options.storyDuration.value)}` : ''}</text>`,
    );
    layout.chapters.forEach((chapter) =>
      body.push(
        `<line x1="${chapter.start}" y1="${headerBaseY - 10 - chapter.lane * 18}" x2="${chapter.end}" y2="${headerBaseY - 10 - chapter.lane * 18}" stroke="${chapter.color}" stroke-width="3"/>`,
        `<text x="${(chapter.start + chapter.end) / 2}" y="${headerBaseY - 20 - chapter.lane * 18}" font-size="10" text-anchor="middle" fill="${chapter.color}">${escapeXml(chapter.durationLabel ?? '')}</text>`,
      ),
    );
  }
  /*
   * The anchored containers, each as a band across the scenes it covers.
   *
   * Drawn before the rows so a band never sits on top of a scene bar, and labelled inside the band
   * when it is wide enough and to its right when it is not - an event pinned to a single moment is a
   * band four pixels wide, and a name centred in it would be unreadable.
   */
  layout.eventSpans.forEach((span) => {
    const y = bandsY + span.lane * TIMELINE_EVENT_LANE_HEIGHT;
    const width = Math.max(4, span.end - span.start);
    body.push(
      `<rect x="${span.start}" y="${y + 3}" width="${width}" height="${TIMELINE_EVENT_LANE_HEIGHT - 8}" rx="4" fill="${span.color}" fill-opacity="${span.isEvent ? 0.34 : 0.18}" stroke="${span.color}" stroke-width="1" ${span.isEvent ? '' : 'stroke-dasharray="4 3"'}/>`,
    );
    // Only the first stretch is named; the rest are the same container resuming.
    if (span.stretchIndex > 0) return;
    const label = truncate(span.name, 28);
    const fitsInside = width > label.length * 6;
    body.push(
      `<text x="${fitsInside ? span.start + width / 2 : span.end + 6}" y="${y + TIMELINE_EVENT_LANE_HEIGHT / 2 + 2}" font-size="10" font-weight="bold" text-anchor="${fitsInside ? 'middle' : 'start'}" fill="${span.color}">${escapeXml(label)}</text>`,
    );
  });
  layout.rows.forEach((row, index) => {
    const y = startY + index * TIMELINE_ROW_HEIGHT;
    const centerY = y + TIMELINE_ROW_HEIGHT / 2;
    const barX = Math.min(row.barStart, row.barEnd);
    const barWidth = Math.max(4, Math.abs(row.barEnd - row.barStart));
    body.push(
      `<rect x="${TIMELINE_PADDING}" y="${y}" width="${layout.width - TIMELINE_PADDING * 2}" height="${TIMELINE_ROW_HEIGHT}" fill="${index % 2 ? options.colors.surface : options.colors.background}" stroke="${options.colors.border}" stroke-width="0.4"/>`,
      // The scene's name and the chapter's share the same column: the second is flush right, and the first
      // is cut by whatever space is left. Cutting both at a fixed number of characters made the two run
      // into each other on long titles.
      ...(() => {
        const chapterLabel = truncate(row.chapterName, 14);
        const chapterWidth = chapterLabel.length * 5;
        const available = TIMELINE_LABEL_WIDTH - TIMELINE_LABEL_PADDING - chapterWidth - 18;
        const sceneLabel = truncate(
          `${row.sequence}. ${row.name}`,
          Math.max(8, Math.floor(available / 6.2)),
        );
        return [
          `<text x="${TIMELINE_PADDING + TIMELINE_LABEL_PADDING}" y="${centerY + 4}" font-size="11" font-weight="bold" fill="${row.chapterColor}">${escapeXml(sceneLabel)}</text>`,
          `<text x="${TIMELINE_PADDING + TIMELINE_LABEL_WIDTH - 8}" y="${centerY + 4}" font-size="9" text-anchor="end" fill="${row.chapterColor}">${escapeXml(chapterLabel)}</text>`,
        ];
      })(),
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
  /*
   * The containers no scene on screen could place, named along the bottom.
   *
   * Listed rather than dropped: an anchor pointing at a scene the reader filtered out is still a
   * statement the writer made, and silently omitting it would read as the app having lost it.
   */
  if (layout.unanchoredNames.length > 0 && options.labels.unanchored)
    body.push(
      `<text x="${TIMELINE_PADDING}" y="${layout.height - TIMELINE_PADDING / 2}" font-size="9" fill="${options.colors.textSecondary}">${escapeXml(options.labels.unanchored)}: ${escapeXml(layout.unanchoredNames.join(', '))}</text>`,
    );
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
