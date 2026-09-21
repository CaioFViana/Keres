import {
  documentTextContent,
  normalizeManuscriptDocument,
  normalizeManuscriptSpans,
} from '@keres/shared';
import type {
  ManuscriptBlock,
  ManuscriptDocument,
  ManuscriptMark,
  ManuscriptSpan,
} from '@keres/shared';

/**
 * Document editing engine: pure state transitions between a manuscript
 * document and the plain-text surface the `TextInput` shows.
 *
 * The surface holds ZERO markup, so surface offsets map 1:1 to content and the
 * styled overlay aligns char-for-char with no invisible characters. Every
 * keystroke arrives as a new surface string; the engine diffs it against the
 * old one (prefix/suffix over the changed block run), splices the span array,
 * and redistributes spans across the new blocks. Marks never cross block
 * boundaries. Selection is always ordered and clamped; the caret after a
 * surface change lands after the inserted text, like the platform keyboard.
 *
 * No React Native imports: this module is UI-agnostic and unit-tested alone.
 * All offsets are UTF-16 code units, matching `TextInput` selections.
 */

export type ManuscriptEditorSelection = { start: number; end: number };

/** Toolbar action: one of the four inline marks, or the heading cycle. */
export type ManuscriptFormatKind = ManuscriptMark | 'heading';

export type ManuscriptEditorState = {
  doc: ManuscriptDocument;
  selection: ManuscriptEditorSelection;
  /**
   * Typing marks armed by toggling on a collapsed caret (Word-style): the next
   * inserted text takes these marks. Cleared by any surface change or any
   * explicit caret move.
   */
  pendingMarks: ManuscriptMark[] | null;
};

export type ManuscriptEditorActiveMarks = {
  marks: ManuscriptMark[];
  /** Heading level of the caret block, 0 when plain. */
  heading: 0 | 1 | 2 | 3;
};

function blockContent(block: ManuscriptBlock): string {
  return block.spans.map((span) => span.text).join('');
}

type BlockLayout = { block: ManuscriptBlock; start: number; length: number }[];

function layoutBlocks(doc: ManuscriptDocument): BlockLayout {
  const layout: BlockLayout = [];
  let cursor = 0;
  for (const block of doc.blocks) {
    const length = blockContent(block).length;
    layout.push({ block, start: cursor, length });
    cursor += length + 2;
  }
  return layout;
}

function clampSelection(
  selection: ManuscriptEditorSelection,
  surfaceLength: number,
): ManuscriptEditorSelection {
  const start = Math.max(0, Math.min(selection.start, surfaceLength));
  const end = Math.max(0, Math.min(selection.end, surfaceLength));
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function sameSelection(a: ManuscriptEditorSelection, b: ManuscriptEditorSelection): boolean {
  return a.start === b.start && a.end === b.end;
}

export function createManuscriptEditor(
  doc: ManuscriptDocument,
  selection: ManuscriptEditorSelection = { start: 0, end: 0 },
): ManuscriptEditorState {
  const normalized = normalizeManuscriptDocument(doc);
  return {
    doc: normalized,
    selection: clampSelection(selection, documentTextContent(normalized).length),
    pendingMarks: null,
  };
}

export function getSurfaceText(state: ManuscriptEditorState): string {
  return documentTextContent(state.doc);
}

export function getEditorCounts(state: ManuscriptEditorState): { chars: number; words: number } {
  const surface = getSurfaceText(state);
  const trimmed = surface.trim();
  return { chars: surface.length, words: trimmed === '' ? 0 : trimmed.split(/\s+/).length };
}

type FlatChar = { char: string; marks: ManuscriptMark[] };

function flattenSpans(spans: ManuscriptSpan[]): FlatChar[] {
  const out: FlatChar[] = [];
  for (const span of spans) {
    for (let i = 0; i < span.text.length; i += 1) {
      out.push({ char: span.text[i], marks: span.marks });
    }
  }
  return out;
}

/** Marks for inserted text: nearest non-newline char, preceding preferred. */
function marksForInsert(spans: ManuscriptSpan[], at: number): ManuscriptMark[] {
  const chars = flattenSpans(spans);
  for (let i = Math.min(at, chars.length) - 1; i >= 0; i -= 1) {
    if (chars[i].char !== '\n') return chars[i].marks;
  }
  for (let i = Math.max(at, 0); i < chars.length; i += 1) {
    if (chars[i].char !== '\n') return chars[i].marks;
  }
  return [];
}

function cutSpans(
  spans: ManuscriptSpan[],
  cutStart: number,
  cutEnd: number,
): [ManuscriptSpan[], ManuscriptSpan[]] {
  const before: ManuscriptSpan[] = [];
  const after: ManuscriptSpan[] = [];
  let offset = 0;
  for (const span of spans) {
    const spanStart = offset;
    const spanEnd = offset + span.text.length;
    offset = spanEnd;
    if (spanEnd <= cutStart || spanStart >= cutEnd) {
      (spanEnd <= cutStart ? before : after).push(span);
      continue;
    }
    const head = span.text.slice(0, Math.max(0, cutStart - spanStart));
    const tail = span.text.slice(Math.max(0, cutEnd - spanStart));
    if (head !== '') before.push({ text: head, marks: span.marks });
    if (tail !== '') after.push({ text: tail, marks: span.marks });
  }
  return [before, after];
}

function spansFromChars(chars: FlatChar[]): ManuscriptSpan[] {
  const spans: ManuscriptSpan[] = [];
  for (const { char, marks } of chars) {
    const last = spans[spans.length - 1];
    if (last && last.marks === marks) {
      last.text += char;
    } else {
      spans.push({ text: char, marks: [...marks] });
    }
  }
  return normalizeManuscriptSpans(spans);
}

function kindOf(
  block: ManuscriptBlock,
): { kind: 'paragraph' } | { kind: 'heading'; level: 1 | 2 | 3 } {
  return block.kind === 'heading' ? { kind: 'heading', level: block.level } : { kind: 'paragraph' };
}

function withKind(
  kind: { kind: 'paragraph' } | { kind: 'heading'; level: 1 | 2 | 3 },
  spans: ManuscriptSpan[],
): ManuscriptBlock {
  return kind.kind === 'heading'
    ? { kind: 'heading', level: kind.level, spans }
    : { kind: 'paragraph', spans };
}

function contentsOf(blocks: ManuscriptBlock[]): string[] {
  return blocks.map(blockContent);
}

/**
 * Known limit: the middle run diffs by prefix/suffix, so typing, delete, paste
 * and single-hunk autocorrect preserve marks, but reordering whole blocks via
 * cut/paste degrades to the surrounding marks. An LCS would fix it; not worth
 * it for v1.
 */
export function applySurfaceChange(
  state: ManuscriptEditorState,
  newSurface: string,
): ManuscriptEditorState {
  const oldSurface = getSurfaceText(state);
  // Pasted Windows text carries \r\n: normalize before block splitting so a
  // pasted blank line still splits blocks (and heading hits one block).
  const surface = newSurface.replace(/\r\n?/g, '\n');
  if (surface === oldSurface) return state;
  const oldBlocks = state.doc.blocks;
  const oldContents = contentsOf(oldBlocks);
  const newContents = surface.split('\n\n');
  let prefix = 0;
  while (
    prefix < oldContents.length &&
    prefix < newContents.length &&
    oldContents[prefix] === newContents[prefix]
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < oldContents.length - prefix &&
    suffix < newContents.length - prefix &&
    oldContents[oldContents.length - 1 - suffix] === newContents[newContents.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const middleOld = oldBlocks.slice(prefix, oldBlocks.length - suffix);
  const middleNewContents = newContents.slice(prefix, newContents.length - suffix);
  const middleOldSpans: ManuscriptSpan[] = [];
  middleOld.forEach((block, index) => {
    if (index > 0) middleOldSpans.push({ text: '\n\n', marks: [] });
    middleOldSpans.push(...block.spans);
  });
  const oldMiddleText = middleOldSpans.map((span) => span.text).join('');
  const newMiddleText = middleNewContents.join('\n\n');
  let commonPrefix = 0;
  while (
    commonPrefix < oldMiddleText.length &&
    commonPrefix < newMiddleText.length &&
    oldMiddleText[commonPrefix] === newMiddleText[commonPrefix]
  ) {
    commonPrefix += 1;
  }
  let commonSuffix = 0;
  while (
    commonSuffix < oldMiddleText.length - commonPrefix &&
    commonSuffix < newMiddleText.length - commonPrefix &&
    oldMiddleText[oldMiddleText.length - 1 - commonSuffix] ===
      newMiddleText[newMiddleText.length - 1 - commonSuffix]
  ) {
    commonSuffix += 1;
  }
  const inserted = newMiddleText.slice(commonPrefix, newMiddleText.length - commonSuffix);
  const [before, after] = cutSpans(
    middleOldSpans,
    commonPrefix,
    oldMiddleText.length - commonSuffix,
  );
  const middle: ManuscriptSpan[] =
    inserted === ''
      ? [...before, ...after]
      : [
          ...before,
          {
            text: inserted,
            marks: state.pendingMarks ?? marksForInsert(middleOldSpans, commonPrefix),
          },
          ...after,
        ];
  const stream = flattenSpans(middle);
  let cursor = 0;
  const middleBlocks = middleNewContents.map((content, index) => {
    const chars = stream.slice(cursor, cursor + content.length);
    cursor += content.length;
    if (index < middleNewContents.length - 1) cursor += 2;
    const kind =
      index === 0 && middleOld.length > 0 ? kindOf(middleOld[0]) : { kind: 'paragraph' as const };
    return withKind(kind, spansFromChars(chars));
  });
  const doc: ManuscriptDocument = {
    blocks: [
      ...oldBlocks.slice(0, prefix),
      ...middleBlocks,
      ...oldBlocks.slice(oldBlocks.length - suffix),
    ],
  };
  const prefixLength = newContents.slice(0, prefix).join('\n\n').length;
  const middleStart = prefixLength + (prefix > 0 && prefix < newContents.length ? 2 : 0);
  const caret = middleStart + commonPrefix + inserted.length;
  return { doc, selection: { start: caret, end: caret }, pendingMarks: null };
}

export function setEditorSelection(
  state: ManuscriptEditorState,
  selection: ManuscriptEditorSelection,
): ManuscriptEditorState {
  const normalized = clampSelection(selection, getSurfaceText(state).length);
  // Identical selection echoes (focus, re-render) must not disarm pending
  // marks: only a real caret move cancels the armed typing style.
  if (sameSelection(normalized, state.selection)) return state;
  return { ...state, selection: normalized, pendingMarks: null };
}

function blockAtOffset(layout: BlockLayout, offset: number): number {
  let index = 0;
  for (let i = 0; i < layout.length; i += 1) {
    if (layout[i].start <= offset) index = i;
  }
  return index;
}

function marksAtCaret(layout: BlockLayout, caret: number): ManuscriptMark[] {
  if (layout.length === 0) return [];
  const entry = layout[blockAtOffset(layout, caret)];
  const relative = Math.max(0, Math.min(caret - entry.start, entry.length));
  const chars = flattenSpans(entry.block.spans);
  for (let i = relative - 1; i >= 0; i -= 1) {
    if (chars[i].char !== '\n') return chars[i].marks;
  }
  for (let i = relative; i < chars.length; i += 1) {
    if (chars[i].char !== '\n') return chars[i].marks;
  }
  return [];
}

function headingAtOffset(layout: BlockLayout, offset: number): 0 | 1 | 2 | 3 {
  if (layout.length === 0) return 0;
  const block = layout[blockAtOffset(layout, offset)].block;
  return block.kind === 'heading' ? block.level : 0;
}

export function getEditorActiveMarks(
  state: ManuscriptEditorState,
  selection: ManuscriptEditorSelection = state.selection,
): ManuscriptEditorActiveMarks {
  const layout = layoutBlocks(state.doc);
  const range = clampSelection(selection, getSurfaceText(state).length);
  const heading = headingAtOffset(layout, range.start);
  if (state.pendingMarks !== null) return { marks: state.pendingMarks, heading };
  if (range.start === range.end) return { marks: marksAtCaret(layout, range.start), heading };
  let active: ManuscriptMark[] | null = null;
  for (const entry of layout) {
    const overlapStart = Math.max(range.start, entry.start);
    const overlapEnd = Math.min(range.end, entry.start + entry.length);
    if (overlapStart >= overlapEnd) continue;
    for (let offset = overlapStart; offset < overlapEnd; offset += 1) {
      const marks = marksAtCaret(layout, offset + 1);
      active = active === null ? [...marks] : active.filter((mark) => marks.includes(mark));
    }
  }
  return { marks: active ?? [], heading };
}

function toggleRangeInBlock(
  block: ManuscriptBlock,
  mark: ManuscriptMark,
  rangeStart: number,
  rangeEnd: number,
): ManuscriptBlock {
  const chars = flattenSpans(block.spans);
  const covered = chars.slice(rangeStart, rangeEnd).filter((entry) => entry.char !== '\n');
  if (covered.length === 0) return block;
  const remove = covered.every((entry) => entry.marks.includes(mark));
  const spans: ManuscriptSpan[] = [];
  let offset = 0;
  for (const span of block.spans) {
    const spanStart = offset;
    const spanEnd = offset + span.text.length;
    offset = spanEnd;
    if (spanEnd <= rangeStart || spanStart >= rangeEnd) {
      spans.push(span);
      continue;
    }
    const head = span.text.slice(0, Math.max(0, rangeStart - spanStart));
    const middle = span.text.slice(
      Math.max(0, rangeStart - spanStart),
      Math.max(0, rangeEnd - spanStart),
    );
    const tail = span.text.slice(Math.max(0, rangeEnd - spanStart));
    if (head !== '') spans.push({ text: head, marks: span.marks });
    if (middle !== '') {
      spans.push({
        text: middle,
        marks: remove
          ? span.marks.filter((candidate) => candidate !== mark)
          : [...span.marks, mark],
      });
    }
    if (tail !== '') spans.push({ text: tail, marks: span.marks });
  }
  const normalized = normalizeManuscriptSpans(spans);
  return block.kind === 'heading'
    ? { kind: 'heading', level: block.level, spans: normalized }
    : { kind: 'paragraph', spans: normalized };
}

export function toggleEditorMark(
  state: ManuscriptEditorState,
  mark: ManuscriptMark,
  range: ManuscriptEditorSelection = state.selection,
): ManuscriptEditorState {
  const layout = layoutBlocks(state.doc);
  const surfaceLength = getSurfaceText(state).length;
  const ordered = clampSelection(range, surfaceLength);
  if (ordered.start === ordered.end) {
    const base = state.pendingMarks ?? marksAtCaret(layout, ordered.start);
    const pending = base.includes(mark)
      ? base.filter((candidate) => candidate !== mark)
      : [...base, mark];
    return { ...state, pendingMarks: pending };
  }
  let changed = false;
  const blocks = layout.map((entry) => {
    const overlapStart = Math.max(ordered.start, entry.start);
    const overlapEnd = Math.min(ordered.end, entry.start + entry.length);
    if (overlapStart >= overlapEnd) return entry.block;
    const next = toggleRangeInBlock(
      entry.block,
      mark,
      overlapStart - entry.start,
      overlapEnd - entry.start,
    );
    if (next !== entry.block) changed = true;
    return next;
  });
  if (!changed) return state;
  return { doc: { blocks }, selection: state.selection, pendingMarks: null };
}

export function toggleEditorHeading(
  state: ManuscriptEditorState,
  offset: number = Math.min(state.selection.start, state.selection.end),
): ManuscriptEditorState {
  if (state.doc.blocks.length === 0) {
    return {
      ...state,
      doc: { blocks: [{ kind: 'heading', level: 1, spans: [] }] },
    };
  }
  const layout = layoutBlocks(state.doc);
  const clamped = Math.max(0, Math.min(offset, getSurfaceText(state).length));
  const target = blockAtOffset(layout, clamped);
  const blocks: ManuscriptBlock[] = state.doc.blocks.map((block, index) => {
    if (index !== target) return block;
    if (block.kind === 'paragraph') return { kind: 'heading', level: 1, spans: block.spans };
    if (block.level < 3)
      return { kind: 'heading', level: (block.level + 1) as 2 | 3, spans: block.spans };
    return { kind: 'paragraph', spans: block.spans };
  });
  return { ...state, doc: { blocks } };
}
