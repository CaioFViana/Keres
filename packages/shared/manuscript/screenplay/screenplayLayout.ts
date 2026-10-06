import {
  emphasisRuns,
  parseFountain,
  type FountainDocument,
  type FountainElement,
  type FountainTitleEntry,
} from './fountainParser';

/*
 * Pages a screenplay the way the industry sets it: Courier 12 pt at ten characters to the inch and six
 * lines to the inch, a wide left margin for the binding, and every element at its own indent.
 * Courier is monospaced, so a page holds a *fixed* number of characters and the count is exact for a
 * given paper and set of margins - which is the whole reason the format is trusted to say "one page, one
 * minute". The same pages feed the estimate shown to the writer and the PDF that is exported, so the
 * number promised is the number delivered.
 */

export type ScreenplayPaper = 'letter' | 'a4';

/** Everything that decides where a character falls, in the units a writer knows. */
export type ScreenplayPreset = {
  paper: ScreenplayPaper;
  /** The PDF core font family used; Courier is metrically the industry's Courier (and Courier Prime). */
  font: 'Courier';
  fontSizePt: number;
  charactersPerInch: number;
  linesPerInch: number;
  /** Page size in points. */
  pageWidthPt: number;
  pageHeightPt: number;
  /** Margins in inches. */
  marginLeftIn: number;
  marginRightIn: number;
  marginTopIn: number;
  marginBottomIn: number;
  /** Where each element starts, in inches from the left edge of the page. */
  indentIn: {
    action: number;
    sceneHeading: number;
    dialogue: number;
    parenthetical: number;
    character: number;
  };
  /** Widths in inches of the columns that are narrower than the page. */
  widthIn: { dialogue: number; parenthetical: number; character: number };
  /** Transitions are right-aligned to this distance from the left edge. */
  transitionRightIn: number;
  /** Blank lines before an element, as Final Draft sets them. */
  spaceBefore: { sceneHeading: number; other: number };
};

const PAPER_POINTS: Record<ScreenplayPaper, { width: number; height: number }> = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
};

/**
 * The industry layout (Final Draft's defaults): 1.5" left margin, 1" right, top and bottom;
 * action and headings at 1.5", dialogue at 2.5", parentheticals at 3.1", character cues at 3.7".
 */
export function screenplayPreset(paper: ScreenplayPaper = 'letter'): ScreenplayPreset {
  const { width, height } = PAPER_POINTS[paper];
  return {
    paper,
    font: 'Courier',
    fontSizePt: 12,
    charactersPerInch: 10,
    linesPerInch: 6,
    pageWidthPt: width,
    pageHeightPt: height,
    marginLeftIn: 1.5,
    marginRightIn: 1,
    marginTopIn: 1,
    marginBottomIn: 1,
    indentIn: { action: 1.5, sceneHeading: 1.5, dialogue: 2.5, parenthetical: 3.1, character: 3.7 },
    widthIn: { dialogue: 3.5, parenthetical: 2.4, character: 3.3 },
    transitionRightIn: 7.1,
    spaceBefore: { sceneHeading: 2, other: 1 },
  };
}

export type ScreenplayGeometry = {
  charWidthPt: number;
  lineHeightPt: number;
  /** Columns of body text between the margins. */
  actionColumns: number;
  /** Lines of body between the top and bottom margins. */
  linesPerPage: number;
};

export function screenplayGeometry(preset: ScreenplayPreset): ScreenplayGeometry {
  const charWidthPt = 72 / preset.charactersPerInch;
  const lineHeightPt = 72 / preset.linesPerInch;
  const textWidth = preset.pageWidthPt - (preset.marginLeftIn + preset.marginRightIn) * 72;
  const textHeight = preset.pageHeightPt - (preset.marginTopIn + preset.marginBottomIn) * 72;
  return {
    charWidthPt,
    lineHeightPt,
    actionColumns: Math.floor(textWidth / charWidthPt + 1e-6),
    linesPerPage: Math.floor(textHeight / lineHeightPt + 1e-6),
  };
}

export type ScreenplaySegment = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

/** One line on a page: where it starts (in columns from the left page edge) and what it says. */
export type ScreenplayLine = {
  row: number;
  /** Column of the first character, from the left edge of the page. */
  column: number;
  segments: ScreenplaySegment[];
  /** Scene numbers printed in both margins beside a heading. */
  sceneNumber?: string;
};

export type ScreenplayPage = { lines: ScreenplayLine[] };

export type ScreenplayLayout = {
  preset: ScreenplayPreset;
  geometry: ScreenplayGeometry;
  titlePage: FountainTitleEntry[];
  /** The script's own pages; the title page is not among them, as it is not numbered. */
  pages: ScreenplayPage[];
  /** Lines of text actually used, blank spacing included. */
  usedLines: number;
};

type Chars = { char: string; bold: boolean; italic: boolean; underline: boolean }[];

function charsOf(text: string, uppercase: boolean, forceItalic = false): Chars {
  const runs = emphasisRuns(text);
  const chars: Chars = [];
  for (const run of runs) {
    const value = uppercase ? run.text.toUpperCase() : run.text;
    for (const char of value) {
      chars.push({
        char,
        bold: run.bold,
        italic: run.italic || forceItalic,
        underline: run.underline,
      });
    }
  }
  return chars;
}

/** Word-wraps styled characters into lines of at most `columns`; a word longer than a line is cut. */
function wrapChars(chars: Chars, columns: number): Chars[] {
  const lines: Chars[] = [];
  let current: Chars = [];
  let word: Chars = [];
  const flushWord = () => {
    if (word.length === 0) return;
    while (word.length > columns) {
      if (current.length > 0) {
        lines.push(trimEnd(current));
        current = [];
      }
      lines.push(word.slice(0, columns));
      word = word.slice(columns);
    }
    if (current.length + word.length > columns) {
      lines.push(trimEnd(current));
      current = [];
    }
    current = current.concat(word);
    word = [];
  };
  for (const char of chars) {
    if (char.char === ' ') {
      flushWord();
      if (current.length > 0) current.push(char);
    } else {
      word.push(char);
    }
  }
  flushWord();
  if (current.length > 0 || lines.length === 0) lines.push(trimEnd(current));
  return lines;
}

function trimEnd(chars: Chars): Chars {
  let end = chars.length;
  while (end > 0 && chars[end - 1].char === ' ') end -= 1;
  return chars.slice(0, end);
}

function segmentsOf(chars: Chars): ScreenplaySegment[] {
  const segments: ScreenplaySegment[] = [];
  for (const char of chars) {
    const last = segments[segments.length - 1];
    if (
      last &&
      last.bold === char.bold &&
      last.italic === char.italic &&
      last.underline === char.underline
    ) {
      last.text += char.char;
    } else {
      segments.push({
        text: char.char,
        bold: char.bold,
        italic: char.italic,
        underline: char.underline,
      });
    }
  }
  return segments;
}

type BlockLine = Omit<ScreenplayLine, 'row'>;

type Block = {
  lines: BlockLine[];
  spaceBefore: number;
  /** A heading never ends a page: it travels with the first lines of what follows. */
  keepWithNext?: boolean;
  /** Where a block may be cut across pages. */
  split?: 'action' | 'dialogue';
  /** For a dialogue: the cue line, repeated with (CONT'D) on the next page. */
  cue?: { chars: Chars; column: number };
  pageBreakBefore?: boolean;
};

const inchesToColumns = (inches: number, preset: ScreenplayPreset) =>
  Math.round(inches * preset.charactersPerInch);

function blocksOf(document: FountainDocument, preset: ScreenplayPreset): Block[] {
  const geometry = screenplayGeometry(preset);
  const blocks: Block[] = [];
  const actionColumn = inchesToColumns(preset.indentIn.action, preset);
  const dialogueColumn = inchesToColumns(preset.indentIn.dialogue, preset);
  const parentheticalColumn = inchesToColumns(preset.indentIn.parenthetical, preset);
  const characterColumn = inchesToColumns(preset.indentIn.character, preset);
  const dialogueColumns = inchesToColumns(preset.widthIn.dialogue, preset);
  const parentheticalColumns = inchesToColumns(preset.widthIn.parenthetical, preset);
  const characterColumns = inchesToColumns(preset.widthIn.character, preset);
  const transitionRight = inchesToColumns(preset.transitionRightIn, preset);
  const centerOfText = Math.round((actionColumn + actionColumn + geometry.actionColumns) / 2);
  const asLines = (chars: Chars[], column: number): BlockLine[] =>
    chars.map((line) => ({ column, segments: segmentsOf(line) }));

  let pendingPageBreak = false;
  const push = (block: Block) => {
    if (pendingPageBreak) {
      block.pageBreakBefore = true;
      pendingPageBreak = false;
    }
    blocks.push(block);
  };

  const elements = document.elements;
  for (let at = 0; at < elements.length; at += 1) {
    const element: FountainElement = elements[at];
    switch (element.type) {
      case 'section':
      case 'synopsis':
        break;
      case 'page-break':
        pendingPageBreak = true;
        break;
      case 'scene-heading': {
        const wrapped = wrapChars(charsOf(element.text, true), geometry.actionColumns);
        const lines = asLines(wrapped, actionColumn);
        if (element.number) {
          lines[0].sceneNumber = element.number;
        }
        push({ lines, spaceBefore: preset.spaceBefore.sceneHeading, keepWithNext: true });
        break;
      }
      case 'action': {
        const lines = element.lines.flatMap((line) =>
          wrapChars(charsOf(line, false), geometry.actionColumns),
        );
        push({
          lines: asLines(lines, actionColumn),
          spaceBefore: preset.spaceBefore.other,
          split: 'action',
        });
        break;
      }
      case 'lyrics': {
        const lines = element.lines.flatMap((line) =>
          wrapChars(charsOf(line, false, true), geometry.actionColumns),
        );
        push({ lines: asLines(lines, actionColumn), spaceBefore: preset.spaceBefore.other });
        break;
      }
      case 'centered': {
        const wrapped = wrapChars(charsOf(element.text, false), geometry.actionColumns);
        push({
          lines: wrapped.map((line) => ({
            column: Math.max(actionColumn, centerOfText - Math.floor(line.length / 2)),
            segments: segmentsOf(line),
          })),
          spaceBefore: preset.spaceBefore.other,
        });
        break;
      }
      case 'transition': {
        const wrapped = wrapChars(charsOf(element.text, true), geometry.actionColumns);
        push({
          lines: wrapped.map((line) => ({
            column: Math.max(actionColumn, transitionRight - line.length),
            segments: segmentsOf(line),
          })),
          spaceBefore: preset.spaceBefore.other,
        });
        break;
      }
      case 'character': {
        const lines: BlockLine[] = [];
        const cueText = element.extension ? `${element.name} (${element.extension})` : element.name;
        const cue = charsOf(cueText, true);
        const [cueFirst] = wrapChars(cue, characterColumns);
        lines.push({ column: characterColumn, segments: segmentsOf(cueFirst) });
        // Parentheticals and dialogue lines belong to the cue just above them.
        let next = at + 1;
        while (
          next < elements.length &&
          (elements[next].type === 'parenthetical' || elements[next].type === 'dialogue')
        ) {
          const part = elements[next];
          if (part.type === 'parenthetical') {
            lines.push(
              ...asLines(
                wrapChars(charsOf(part.text, false), parentheticalColumns),
                parentheticalColumn,
              ),
            );
          } else if (part.type === 'dialogue') {
            for (const text of part.lines) {
              lines.push(
                ...asLines(wrapChars(charsOf(text, false), dialogueColumns), dialogueColumn),
              );
            }
          }
          next += 1;
        }
        at = next - 1;
        push({
          lines,
          spaceBefore: preset.spaceBefore.other,
          split: 'dialogue',
          cue: { chars: cueFirst, column: characterColumn },
        });
        break;
      }
      default:
        // A parenthetical or dialogue with no cue before it: set it as dialogue so it is not lost.
        if (element.type === 'dialogue') {
          const lines = element.lines.flatMap((text) =>
            wrapChars(charsOf(text, false), dialogueColumns),
          );
          push({ lines: asLines(lines, dialogueColumn), spaceBefore: preset.spaceBefore.other });
        } else if (element.type === 'parenthetical') {
          push({
            lines: asLines(
              wrapChars(charsOf(element.text, false), parentheticalColumns),
              parentheticalColumn,
            ),
            spaceBefore: 0,
          });
        }
    }
  }
  return blocks;
}

/**
 * Pages Fountain text. Rules the industry keeps: a heading never ends a page, an action or a speech
 * leaves at least two lines on each side of a break, and a speech cut across pages says (MORE) and
 * comes back with the cue and (CONT'D).
 */
export function layoutScreenplay(
  source: string | FountainDocument,
  preset: ScreenplayPreset = screenplayPreset(),
): ScreenplayLayout {
  const document = typeof source === 'string' ? parseFountain(source) : source;
  const geometry = screenplayGeometry(preset);
  const capacity = geometry.linesPerPage;
  const blocks = blocksOf(document, preset);

  const pages: ScreenplayPage[] = [];
  let page: ScreenplayPage = { lines: [] };
  let row = 0;
  let usedLines = 0;

  pages.push(page);

  const place = (lines: BlockLine[], spaceBefore: number) => {
    row += spaceBefore;
    usedLines += spaceBefore;
    for (const line of lines) {
      page.lines.push({ ...line, row });
      row += 1;
      usedLines += 1;
    }
  };
  const nextPage = () => {
    page = { lines: [] };
    pages.push(page);
    row = 0;
  };

  blocks.forEach((block, index) => {
    if (block.pageBreakBefore && page.lines.length > 0) nextPage();

    let spaceBefore = row === 0 ? 0 : block.spaceBefore;
    let lines = block.lines;
    // A heading rides with what follows it: at least its first two lines.
    const following = blocks[index + 1];
    const keep =
      block.keepWithNext && following
        ? following.spaceBefore + Math.min(2, following.lines.length)
        : 0;

    for (;;) {
      const remaining = capacity - row;
      const needed = spaceBefore + lines.length + keep;
      if (needed <= remaining || (row === 0 && lines.length <= capacity)) {
        place(lines, spaceBefore);
        return;
      }

      // Does not fit. Try to cut it, as the rules allow; otherwise carry it whole to the next page.
      const room = remaining - spaceBefore;
      if (block.split === 'action' && room >= 2 && lines.length - room >= 2) {
        place(lines.slice(0, room), spaceBefore);
        lines = lines.slice(room);
        nextPage();
        spaceBefore = 0;
        continue;
      }
      if (block.split === 'action' && room >= 3 && lines.length - (room - 1) >= 2) {
        // Pull one line over, so the new page does not start with a lone line.
        place(lines.slice(0, room - 1), spaceBefore);
        lines = lines.slice(room - 1);
        nextPage();
        spaceBefore = 0;
        continue;
      }
      if (block.split === 'dialogue' && block.cue) {
        // cue + at least two lines + (MORE), and at least two lines left for the next page.
        const bodyLines = lines.slice(1);
        const take = room - 2;
        if (take >= 2 && bodyLines.length - take >= 2) {
          place([lines[0], ...bodyLines.slice(0, take)], spaceBefore);
          const dialogueColumn = inchesToColumns(preset.indentIn.dialogue, preset);
          place(
            [
              {
                column: dialogueColumn,
                segments: [{ text: '(MORE)', bold: false, italic: false, underline: false }],
              },
            ],
            0,
          );
          const cueText = `${segmentsText(lines[0].segments)} (CONT'D)`;
          const cueLine: BlockLine = {
            column: block.cue.column,
            segments: [{ text: cueText, bold: false, italic: false, underline: false }],
          };
          lines = [cueLine, ...bodyLines.slice(take)];
          nextPage();
          spaceBefore = 0;
          continue;
        }
      }
      if (row === 0) {
        // Taller than a page and nothing allowed to cut it: cut it hard rather than loop forever.
        place(lines.slice(0, capacity), 0);
        lines = lines.slice(capacity);
        nextPage();
        continue;
      }
      nextPage();
      spaceBefore = 0;
    }
  });

  const kept = pages.filter((candidate) => candidate.lines.length > 0);
  return {
    preset,
    geometry,
    titlePage: document.titlePage,
    pages: kept,
    usedLines,
  };
}

function segmentsText(segments: ScreenplaySegment[]): string {
  return segments.map((segment) => segment.text).join('');
}

export type ScreenplayEstimate = {
  /** Printed pages of script, the title page not counted. */
  pages: number;
  /** The same in eighths of a page, the way a script is counted ("62 3/8"). */
  eighths: number;
  /** The preset the number stands on: showing it is what lets a writer reproduce it. */
  preset: ScreenplayPreset;
  geometry: ScreenplayGeometry;
};

/** Pages a screenplay will have, and the eighths of the last one, under a preset. */
export function estimateScreenplayPages(
  source: string | FountainDocument,
  preset: ScreenplayPreset = screenplayPreset(),
): ScreenplayEstimate {
  const layout = layoutScreenplay(source, preset);
  const lastPage = layout.pages[layout.pages.length - 1];
  const lastRow = lastPage ? lastPage.lines[lastPage.lines.length - 1].row + 1 : 0;
  const eighthsInLast = Math.ceil((lastRow / layout.geometry.linesPerPage) * 8);
  const full = Math.max(0, layout.pages.length - 1);
  return {
    pages: layout.pages.length,
    eighths: full * 8 + (lastPage ? eighthsInLast : 0),
    preset,
    geometry: layout.geometry,
  };
}

/** `62 3/8`: whole pages and the eighths of the last, as scripts are counted. */
export function formatEighths(eighths: number): string {
  const whole = Math.floor(eighths / 8);
  const rest = eighths % 8;
  if (rest === 0) return String(whole);
  return whole === 0 ? `${rest}/8` : `${whole} ${rest}/8`;
}
