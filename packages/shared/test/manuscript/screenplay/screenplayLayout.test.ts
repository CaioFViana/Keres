import { describe, expect, it } from 'vitest';
import {
  estimateScreenplayPages,
  formatEighths,
  layoutScreenplay,
  screenplayGeometry,
  screenplayPreset,
} from '../../../manuscript/screenplay/screenplayLayout';

const textOf = (line: { segments: { text: string }[] }) =>
  line.segments.map((segment) => segment.text).join('');

describe('screenplay geometry', () => {
  it('is the industry page on Letter: ten characters and six lines to the inch', () => {
    const geometry = screenplayGeometry(screenplayPreset('letter'));

    expect(geometry.charWidthPt).toBe(7.2);
    expect(geometry.lineHeightPt).toBe(12);
    // 8.5" - 1.5" - 1.0" = 6" of text = 60 columns; 11" - 2" = 9" = 54 lines.
    expect(geometry.actionColumns).toBe(60);
    expect(geometry.linesPerPage).toBe(54);
  });

  it('fits A4 with the same margins, so the count changes with the paper and says so', () => {
    const letter = screenplayGeometry(screenplayPreset('letter'));
    const a4 = screenplayGeometry(screenplayPreset('a4'));

    expect(a4.actionColumns).toBe(57);
    expect(a4.linesPerPage).toBe(58);
    expect(a4.linesPerPage).toBeGreaterThan(letter.linesPerPage);
    expect(a4.actionColumns).toBeLessThan(letter.actionColumns);
  });
});

describe('layoutScreenplay', () => {
  it('puts every element at its indent', () => {
    const { pages } = layoutScreenplay(
      'INT. KITCHEN - DAY\n\nShe waits.\n\nMOM\n(softly)\nBe careful.\n\nCUT TO:',
    );
    const lines = pages[0].lines;
    const at = (text: string) => lines.find((line) => textOf(line).startsWith(text))!;

    expect(at('INT. KITCHEN').column).toBe(15);
    expect(at('She waits.').column).toBe(15);
    expect(at('MOM').column).toBe(37);
    expect(at('(softly)').column).toBe(31);
    expect(at('Be careful.').column).toBe(25);
    // Right-aligned to 7.1": its last character ends at column 71.
    const transition = at('CUT TO:');
    expect(transition.column + textOf(transition).length).toBe(71);
  });

  it('spaces elements as Final Draft does and starts a page flush at the top', () => {
    const { pages } = layoutScreenplay('INT. A\n\nAction.\n\nMOM\nHi.');
    const rows = pages[0].lines.map((line) => [textOf(line), line.row]);

    expect(rows).toEqual([
      ['INT. A', 0],
      ['Action.', 2],
      ['MOM', 4],
      ['Hi.', 5],
    ]);
  });

  it('writes headings and cues in capitals, and keeps the emphasis', () => {
    const { pages } = layoutScreenplay('int. cellar\n\n*Slowly*, she **turns**.\n\n@sam\nHey.');
    const lines = pages[0].lines;

    expect(textOf(lines[0])).toBe('INT. CELLAR');
    expect(
      lines[1].segments.map((segment) => [segment.text, segment.italic, segment.bold]),
    ).toEqual([
      ['Slowly', true, false],
      [', she ', false, false],
      ['turns', false, true],
      ['.', false, false],
    ]);
    expect(textOf(lines[2])).toBe('SAM');
  });

  it('wraps action at 60 columns and dialogue at 35', () => {
    const long = Array.from({ length: 30 }, () => 'word').join(' ');
    const { pages } = layoutScreenplay(`${long}\n\nMOM\n${long}`);
    const lines = pages[0].lines;

    for (const line of lines) {
      const width = textOf(line).length;
      if (line.column === 15) expect(width).toBeLessThanOrEqual(60);
      if (line.column === 25) expect(width).toBeLessThanOrEqual(35);
    }
    expect(lines.filter((line) => line.column === 15).length).toBeGreaterThan(2);
  });

  it('numbers a scene in the margin', () => {
    const { pages } = layoutScreenplay('INT. KITCHEN #12A#\n\nAction.');

    expect(pages[0].lines[0].sceneNumber).toBe('12A');
  });

  it('starts a new page at a page break and drops the outline, which is never printed', () => {
    const { pages } = layoutScreenplay('# Act\n= synopsis\n\nINT. A\n\nOne.\n\n===\n\nTwo.');

    expect(pages).toHaveLength(2);
    expect(pages[0].lines.map(textOf)).toEqual(['INT. A', 'One.']);
    expect(pages[1].lines.map(textOf)).toEqual(['Two.']);
  });

  it('leaves the title page out of the pages and hands it over', () => {
    const layout = layoutScreenplay('Title: X\nAuthor: Ana\n\nINT. A\n\nOne.');

    expect(layout.titlePage).toEqual([
      { key: 'Title', value: 'X' },
      { key: 'Author', value: 'Ana' },
    ]);
    expect(layout.pages).toHaveLength(1);
  });

  it('fills a page to its last line and then breaks', () => {
    // Each action is 1 line plus 1 blank before it: 27 of them fill 54 lines (the first has no blank).
    const script = Array.from({ length: 40 }, (_, number) => `Beat ${number + 1}.`).join('\n\n');
    const { pages, geometry } = layoutScreenplay(script);

    expect(geometry.linesPerPage).toBe(54);
    expect(pages.length).toBe(2);
    expect(Math.max(...pages[0].lines.map((line) => line.row))).toBeLessThan(54);
  });

  it('never ends a page on a heading', () => {
    // Fill a page up to its last two lines, then a heading with its action.
    const filler = Array.from({ length: 26 }, (_, number) => `Beat ${number + 1}.`).join('\n\n');
    const { pages } = layoutScreenplay(`${filler}\n\nINT. NEXT\n\nAction under it.`);
    const lastOfFirst = textOf(pages[0].lines[pages[0].lines.length - 1]);

    expect(lastOfFirst.startsWith('INT.')).toBe(false);
    expect(textOf(pages[1].lines[0])).toBe('INT. NEXT');
  });

  it('cuts a long action leaving at least two lines on each side', () => {
    const filler = Array.from({ length: 25 }, (_, number) => `Beat ${number + 1}.`).join('\n\n');
    const paragraph = Array.from({ length: 90 }, () => 'long').join(' ');
    const { pages } = layoutScreenplay(`${filler}\n\n${paragraph}`);
    const onFirst = pages[0].lines.filter((line) => line.column === 15).length;
    const onSecond = pages[1].lines.filter((line) => line.column === 15).length;

    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(onFirst).toBeGreaterThanOrEqual(2);
    expect(onSecond).toBeGreaterThanOrEqual(2);
  });

  it("cuts a speech across pages with (MORE) and comes back with (CONT'D)", () => {
    const filler = Array.from({ length: 24 }, (_, number) => `Beat ${number + 1}.`).join('\n\n');
    const speech = Array.from({ length: 40 }, () => 'talk').join(' ');
    const { pages } = layoutScreenplay(`${filler}\n\nMOM\n${speech}`);
    const first = pages[0].lines.map(textOf);
    const second = pages[1].lines.map(textOf);

    expect(first[first.length - 1]).toBe('(MORE)');
    expect(second[0]).toBe("MOM (CONT'D)");
  });

  it('carries a speech whole to the next page when it cannot be cut fairly', () => {
    const filler = Array.from({ length: 26 }, (_, number) => `Beat ${number + 1}.`).join('\n\n');
    const { pages } = layoutScreenplay(`${filler}\n\nMOM\nShort.`);

    const lastOfFirst = textOf(pages[0].lines[pages[0].lines.length - 1]);
    expect(lastOfFirst).not.toBe('MOM');
    expect(pages.flatMap((page) => page.lines.map(textOf))).toContain('Short.');
  });

  it('handles an empty script', () => {
    expect(layoutScreenplay('').pages).toEqual([]);
    expect(estimateScreenplayPages('').pages).toBe(0);
  });
});

describe('estimateScreenplayPages', () => {
  it('counts pages and eighths under a stated preset', () => {
    const script = Array.from({ length: 40 }, (_, number) => `Beat ${number + 1}.`).join('\n\n');
    const estimate = estimateScreenplayPages(script, screenplayPreset('letter'));

    expect(estimate.pages).toBe(2);
    expect(estimate.eighths).toBeGreaterThan(8);
    expect(estimate.eighths).toBeLessThanOrEqual(16);
    expect(estimate.preset.paper).toBe('letter');
    expect(estimate.geometry.linesPerPage).toBe(54);
  });

  it('gives a different count on A4 for the same text, because the page is not the same', () => {
    const script = Array.from({ length: 400 }, (_, number) => `Beat ${number + 1}.`).join('\n\n');

    expect(estimateScreenplayPages(script, screenplayPreset('a4')).pages).toBeLessThan(
      estimateScreenplayPages(script, screenplayPreset('letter')).pages,
    );
  });

  it('writes eighths the way scripts are counted', () => {
    expect(formatEighths(0)).toBe('0');
    expect(formatEighths(8)).toBe('1');
    expect(formatEighths(3)).toBe('3/8');
    expect(formatEighths(8 * 62 + 3)).toBe('62 3/8');
  });
});
