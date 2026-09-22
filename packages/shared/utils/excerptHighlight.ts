/**
 * Highlighter anchoring for comment excerpts and manuscript search.
 *
 * Comment excerpts anchor by the user-decided rule: the FIRST occurrence in the source
 * text, case- AND accent-insensitive (`manha` anchors `manhã`). Manuscript search keeps
 * its own case-insensitive-only rule (`findManuscriptMatches`) and shares only the
 * splitting mechanics below, so search counts never drift from their marks.
 *
 * All offsets are UTF-16 code-unit offsets into the ORIGINAL text, ready for `slice`
 * and for nested `<Text>` rendering.
 */
export interface TextRange {
  /** Offset of the first anchored character in the original text. */
  start: number;
  /** Anchored span length in the original text. */
  length: number;
}

export interface TextSegment {
  text: string;
  marked: boolean;
}

/** Fold one character for accent-insensitive comparison: strip marks, then lower. */
function foldChar(char: string): string {
  return char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function foldText(text: string): string {
  let folded = '';
  for (const char of text) folded += foldChar(char);
  return folded;
}

/**
 * Fold the source while remembering which original character produced each folded one,
 * so a folded `indexOf` hit maps back to exact original offsets even when accented
 * characters (one original unit, one folded unit after stripping) shift positions.
 */
function foldWithMap(text: string): { folded: string; starts: number[]; ends: number[] } {
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const char of text) {
    const piece = foldChar(char);
    for (let index = 0; index < piece.length; index += 1) {
      starts.push(offset);
      ends.push(offset + char.length);
    }
    folded += piece;
    offset += char.length;
  }
  return { folded, starts, ends };
}

/**
 * First occurrence of `excerpt` in `sourceText`, case- and accent-insensitive.
 * Surrounding whitespace (typed/pasted with the excerpt) is ignored; stored excerpts
 * are already trimmed. Returns null when the excerpt is empty or no longer found -
 * the source text may have changed since the excerpt was saved, so callers render
 * normally with no mark and no error.
 */
export function findFirstExcerptMatch(
  sourceText: string,
  excerpt: string | null | undefined,
): TextRange | null {
  if (!sourceText || typeof excerpt !== 'string') return null;
  const trimmed = excerpt.trim();
  if (!trimmed) return null;
  const needle = foldText(trimmed);
  if (!needle) return null;
  const { folded, starts, ends } = foldWithMap(sourceText);
  const at = folded.indexOf(needle);
  if (at === -1) return null;
  const start = starts[at];
  const end = ends[at + needle.length - 1];
  return { start, length: end - start };
}

/**
 * Every non-overlapping occurrence of `query` in `text`, case-insensitive ONLY - the
 * same rule `findManuscriptMatches` counts by, so visual marks and the match counter
 * always agree. Empty or absent queries mark nothing.
 */
export function findAllCaseInsensitiveMatches(
  text: string,
  query: string | null | undefined,
): TextRange[] {
  if (!text || typeof query !== 'string') return [];
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const haystack = text.toLowerCase();
  const ranges: TextRange[] = [];
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    ranges.push({ start: at, length: needle.length });
    from = at + needle.length;
  }
  return ranges;
}

/**
 * Split `text` into marked/unmarked segments for one set of ranges. Ranges are sorted,
 * clamped into the text, and empty or fully out-of-bounds ranges are dropped, so
 * callers can render the segments directly with no further checks.
 */
export function splitTextByRanges(text: string, ranges: TextRange[]): TextSegment[] {
  const usable = ranges
    .map((range) => ({
      start: Math.max(0, range.start),
      end: Math.min(text.length, range.start + range.length),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (usable.length === 0) return [{ text, marked: false }];
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const range of usable) {
    if (range.start > cursor)
      segments.push({ text: text.slice(cursor, range.start), marked: false });
    // Overlapping ranges collapse onto the furthest end: a character is marked once.
    const end = Math.max(range.end, cursor);
    if (end > Math.max(range.start, cursor)) {
      segments.push({ text: text.slice(Math.max(range.start, cursor), end), marked: true });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), marked: false });
  return segments;
}
