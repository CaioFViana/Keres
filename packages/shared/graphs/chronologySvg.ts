import type { ChronologyLayout, ChronologyNode } from './chronologyLayout';

export const CHRONOLOGY_PADDING = 28;
export const CHRONOLOGY_LABEL_WIDTH = 196;
export const CHRONOLOGY_LABEL_PADDING = 10;
export const CHRONOLOGY_ROW_HEIGHT = 58;
const HEADER_HEIGHT = 64;
const STEP_WIDTH = 128;
const BAR_HEIGHT = 20;

/**
 * The chronology, drawn in the same idiom as the narrative timeline: a label column on the left and
 * bars on an axis to the right, one row per container.
 *
 * It is deliberately the *same* picture read against a different axis, because that is exactly what
 * the feature is. The narrative timeline's axis is elapsed story time along the spine; this one's is
 * **stated order** - how many steps in the writer has placed a container. Making them look alike is
 * the point: a reader who understands one can read the other.
 *
 * ## What the axis is not
 *
 * It is not clock time, and it says so. Spacing by duration would answer a question the writer never
 * did: two containers with nothing stated between them have no measurable distance, only an
 * unstated one.
 *
 * A bar **spans** the steps its container occupies. An era running across chapters three to five is
 * drawn across those three steps, because that is what the writer said - drawing it at the first
 * alone would say it ended when it did not.
 *
 * Steps are named after the chapter that occupies them, when one does. The axis is the story's own
 * spine wherever the story has one, which is what makes it readable rather than a counter.
 */
export interface ChronologySvgOptions {
  subtitle: string;
  labels: {
    /** Names the axis, e.g. "stated order". */
    axis: string;
    /** Fallback for a step no single chapter occupies. */
    step: string;
    unplaced: string;
    cycle: string;
    /** One phrase per relation that is not precedence, keyed by its type. */
    ties: { during: string; overlaps: string; simultaneous: string };
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    warning: string;
  };
}

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const truncate = (value: string, max: number) =>
  value.length > max ? `${value.slice(0, Math.max(1, max - 1))}…` : value;

export function renderChronologySvg(
  layout: ChronologyLayout,
  options: ChronologySvgOptions,
): string {
  const { colors, labels } = options;

  const ordered = [...layout.nodes].sort(
    (a, b) => a.band - b.band || a.slot - b.slot || a.name.localeCompare(b.name),
  );
  const rows = [...ordered, ...layout.unplaced];

  const steps = Math.max(layout.bandCount, 1);
  const axisWidth = steps * STEP_WIDTH;
  const width = CHRONOLOGY_PADDING * 2 + CHRONOLOGY_LABEL_WIDTH + axisWidth;

  // The divider before the unplaced block is a row of its own, so it never lands on top of one.
  const unplacedHeaderRows = layout.unplaced.length > 0 ? 1 : 0;
  const height =
    HEADER_HEIGHT + (rows.length + unplacedHeaderRows) * CHRONOLOGY_ROW_HEIGHT + CHRONOLOGY_PADDING;

  const axisLeft = CHRONOLOGY_PADDING + CHRONOLOGY_LABEL_WIDTH;
  const stepX = (band: number) => axisLeft + band * STEP_WIDTH;

  const body: string[] = [
    `<rect width="${width}" height="${height}" fill="${colors.background}"/>`,
    `<text x="${CHRONOLOGY_PADDING}" y="18" font-size="11" fill="${colors.textSecondary}">${escapeXml(options.subtitle)}</text>`,
  ];

  if (layout.hasCycle) {
    body.push(
      `<text x="${width - CHRONOLOGY_PADDING}" y="18" font-size="11" text-anchor="end" fill="${colors.warning}">${escapeXml(labels.cycle)}</text>`,
    );
  }

  /*
   * The axis, with one tick per stated step - the same ruler the narrative timeline draws.
   *
   * Its caption sits over the *label* column rather than over the axis: on the axis it lands on top
   * of the first step's own label, and the two shortest strings on the screen are the two that must
   * not be read as one.
   */
  body.push(
    `<text x="${CHRONOLOGY_PADDING}" y="${HEADER_HEIGHT - 14}" font-size="10" fill="${colors.textSecondary}">${escapeXml(labels.axis)}</text>`,
    `<line x1="${axisLeft}" y1="${HEADER_HEIGHT - 6}" x2="${width - CHRONOLOGY_PADDING}" y2="${HEADER_HEIGHT - 6}" stroke="${colors.border}"/>`,
  );
  for (let band = 0; band < steps; band += 1) {
    const step = layout.steps[band];
    // The chapter's own number and name where one owns the step; the bare counter only where the
    // step belongs to nothing in particular, which is the case a writer cannot name either.
    const label = step?.chapterName
      ? `${step.chapterIndex}. ${step.chapterName}`
      : `${labels.step} ${band + 1}`;
    body.push(
      `<line x1="${stepX(band)}" y1="${HEADER_HEIGHT - 11}" x2="${stepX(band)}" y2="${HEADER_HEIGHT - 1}" stroke="${colors.textSecondary}"/>`,
      `<text x="${stepX(band) + 6}" y="${HEADER_HEIGHT - 14}" font-size="10" fill="${colors.textSecondary}">${escapeXml(truncate(label, 18))}</text>`,
    );
  }

  const drawRow = (node: ChronologyNode, index: number, y: number) => {
    const centerY = y + CHRONOLOGY_ROW_HEIGHT / 2;
    const placed = node.band >= 0;
    const barX = placed ? stepX(node.band) + 4 : axisLeft + 4;
    /*
     * The bar covers the steps the container occupies.
     *
     * One step for a chapter of the spine; several for anything the writer tied across a range. A
     * container with no span of its own and nothing to widen it gets a short marker rather than a
     * full step, so a bar's length never claims a duration nobody gave.
     */
    const spannedSteps = placed ? node.bandEnd - node.band + 1 : 1;
    const barWidth = spannedSteps > 1 || node.durationLabel ? spannedSteps * STEP_WIDTH - 16 : 26;
    const colour = node.inCycle ? colors.warning : placed ? colors.primary : colors.textSecondary;

    /*
     * A placed container gets a solid bar; an unplaced one gets an outline.
     *
     * Both start at the same x - there is nowhere else for the second to begin - so filling them
     * alike would read as "this one is at step 1", which is the opposite of what the row means.
     * The outline says the bar is off the axis rather than at its start.
     */
    const barFill = placed
      ? `fill="${colour}" fill-opacity="0.82"`
      : `fill="none" stroke="${colour}" stroke-width="1.2" stroke-dasharray="4 3"`;

    body.push(
      `<rect x="${CHRONOLOGY_PADDING}" y="${y}" width="${width - CHRONOLOGY_PADDING * 2}" height="${CHRONOLOGY_ROW_HEIGHT}" fill="${index % 2 ? colors.surface : colors.background}" stroke="${colors.border}" stroke-width="0.4"/>`,
      `<text x="${CHRONOLOGY_PADDING + CHRONOLOGY_LABEL_PADDING}" y="${centerY + 4}" font-size="11" font-weight="bold" fill="${colour}">${escapeXml(truncate((node.isEvent ? '⏳ ' : '') + node.name, 30))}</text>`,
      `<rect x="${barX}" y="${centerY - BAR_HEIGHT / 2}" width="${barWidth}" height="${BAR_HEIGHT}" rx="5" ${barFill}/>`,
    );

    if (node.durationLabel) {
      body.push(
        `<text x="${barX + barWidth / 2}" y="${centerY + 4}" font-size="9" text-anchor="middle" fill="${placed ? '#fff' : colors.textSecondary}">${escapeXml(truncate(node.durationLabel, 22))}</text>`,
      );
    }
  };

  const rowY = new Map<string, number>();
  let rowIndex = 0;
  ordered.forEach((node) => {
    const y = HEADER_HEIGHT + rowIndex * CHRONOLOGY_ROW_HEIGHT;
    rowY.set(node.id, y + CHRONOLOGY_ROW_HEIGHT / 2);
    drawRow(node, rowIndex, y);
    rowIndex += 1;
  });

  if (layout.unplaced.length > 0) {
    const y = HEADER_HEIGHT + rowIndex * CHRONOLOGY_ROW_HEIGHT;
    body.push(
      `<line x1="${CHRONOLOGY_PADDING}" y1="${y + CHRONOLOGY_ROW_HEIGHT / 2}" x2="${width - CHRONOLOGY_PADDING}" y2="${y + CHRONOLOGY_ROW_HEIGHT / 2}" stroke="${colors.border}" stroke-dasharray="4 4"/>`,
      `<text x="${CHRONOLOGY_PADDING}" y="${y + CHRONOLOGY_ROW_HEIGHT / 2 - 8}" font-size="10" fill="${colors.textSecondary}">${escapeXml(labels.unplaced)}</text>`,
    );
    rowIndex += 1;
    layout.unplaced.forEach((node) => {
      drawRow(node, rowIndex, HEADER_HEIGHT + rowIndex * CHRONOLOGY_ROW_HEIGHT);
      rowIndex += 1;
    });
  }

  /*
   * Everything the relation says that the axis cannot.
   *
   * A step only carries `before`. Containment and the two unordered kinds say something real and
   * would otherwise leave no mark at all - the writer would state "the skirmish happened during the
   * war" and see nothing change. They are drawn as a bracket joining the two rows, in the gutter
   * left of the axis so they never cross a bar, and labelled with the phrase itself: the shape says
   * *these two are related*, the word says how.
   */
  const ties = layout.edges.filter((edge) => edge.relationType !== 'before');
  ties.forEach((edge, index) => {
    const fromY = rowY.get(edge.fromId);
    const toY = rowY.get(edge.toId);
    if (fromY === undefined || toY === undefined || fromY === toY) return;

    // Each tie gets its own lane in the gutter, so two of them never trace the same line.
    const laneX = axisLeft - 8 - (index % 3) * 6;
    const top = Math.min(fromY, toY);
    const bottom = Math.max(fromY, toY);
    const phrase = labels.ties[edge.relationType as keyof typeof labels.ties];

    body.push(
      `<path d="M ${laneX + 5} ${top} L ${laneX} ${top} L ${laneX} ${bottom} L ${laneX + 5} ${bottom}" fill="none" stroke="${colors.textSecondary}" stroke-width="1.2" stroke-dasharray="4 3"/>`,
    );
    if (phrase) {
      body.push(
        `<text x="${laneX - 4}" y="${(top + bottom) / 2 + 3}" font-size="9" text-anchor="end" fill="${colors.textSecondary}">${escapeXml(phrase)}</text>`,
      );
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${body.join('\n')}
</svg>`;
}
