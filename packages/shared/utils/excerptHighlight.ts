/**
 * Highlighter anchoring for comment excerpts and manuscript search, plus the centered
 * excerpts mention backlinks show per occurrence.
 *
 * Comment excerpts anchor by the user-decided rule: the FIRST occurrence in the source
 * text, case- AND accent-insensitive (`manha` anchors `manhã`). Manuscript search keeps
 * its own case-insensitive-only rule (`findManuscriptMatches`) and shares only the
 * splitting mechanics below, so search counts never drift from their marks. Backlinks
 * reuse the same range vocabulary to frame the match instead of the text head.
 *
 * All offsets are UTF-16 code-unit offsets into the ORIGINAL text, ready for `slice`
 * and for nested `<Text>` rendering.
 *
 * Prose comment previews compare in the same rendered space they show (see
 * `stripMarkdownText`): strip both sides, then match with the plain rule below.
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
 * Preview text reads as one flowing line: every whitespace run (line breaks
 * included) collapses to a single space, ends trimmed. Both preview and excerpt
 * go through this, so anchors agree across line breaks too.
 */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
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
 * Slice one block-level match into per-span local ranges, parallel to
 * `spanTexts`: a block renders its spans concatenated with no separator, so a
 * match over the joined text overlaps each span exactly here. Spans the match
 * never reaches get an empty array.
 */
export function sliceMatchAcrossSpans(spanTexts: string[], match: TextRange): TextRange[][] {
  const matchStart = Math.max(0, match.start);
  const matchEnd = Math.max(matchStart, match.start + match.length);
  let cursor = 0;
  return spanTexts.map((spanText) => {
    const spanStart = cursor;
    cursor += spanText.length;
    const start = Math.max(matchStart, spanStart);
    const end = Math.min(matchEnd, cursor);
    if (end <= start) return [];
    return [{ start: start - spanStart, length: end - start }];
  });
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

export interface FramedMatchWindow {
  /** The framed text: window with an ellipsis on each cut side. */
  text: string;
  /** The match relocated into `text`, clamped to its visible part. */
  match: TextRange;
}

/**
 * A window of at most `maxLength` characters framed around `match`: short texts pass
 * through untouched, longer ones center on the match with an ellipsis on each cut side.
 * Cut edges are trimmed so the ellipsis never hugs a stray space, and the match is
 * relocated into the framed text so callers can mark it where it shows.
 */
export function frameMatchWindow(
  text: string,
  match: TextRange,
  maxLength: number = 150,
): FramedMatchWindow {
  if (text.length <= maxLength)
    return { text, match: { start: match.start, length: match.length } };
  const safeLength = Math.max(1, maxLength);
  const center = match.start + Math.max(0, match.length) / 2;
  let windowStart = Math.round(center - safeLength / 2);
  windowStart = Math.max(0, Math.min(windowStart, text.length - safeLength));
  // A match longer than the window still opens at the match instead of centering past it.
  if (match.length >= safeLength) windowStart = Math.min(match.start, text.length - safeLength);
  const rawWindow = text.slice(windowStart, windowStart + safeLength);
  const leadingCut = rawWindow.length - rawWindow.trimStart().length;
  const trailingCut = rawWindow.length - rawWindow.trimEnd().length;
  const window = rawWindow.trim();
  const prefix = windowStart > 0 ? '…' : '';
  const suffix = windowStart + safeLength < text.length ? '…' : '';
  const matchEnd = match.start + Math.max(0, match.length);
  const visibleEnd = windowStart + rawWindow.length - trailingCut;
  const start = prefix.length + Math.max(0, match.start - windowStart - leadingCut);
  const end = prefix.length + Math.max(0, Math.min(matchEnd, visibleEnd) - windowStart - leadingCut);
  return {
    text: `${prefix}${window}${suffix}`,
    match: { start, length: Math.max(0, end - start) },
  };
}

/**
 * The framed text alone, for callers that show context without marking it
 * (mention backlinks). Same window `frameMatchWindow` reports the match in.
 */
export function excerptAroundMatch(
  text: string,
  match: TextRange,
  maxLength: number = 150,
): string {
  return frameMatchWindow(text, match, maxLength).text;
}

export interface ActiveTextSegment extends TextSegment {
  active: boolean;
}

/** Clamp ranges into the text, drop empties, sort by start then end. */
function normalizeRanges(text: string, input: TextRange[]): { start: number; end: number }[] {
  return input
    .map((range) => ({
      start: Math.max(0, range.start),
      end: Math.min(text.length, range.start + range.length),
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Split `text` by `ranges`, flagging the segments an `activeRanges` entry touches -
 * the current search hit among all hits. An active range need not equal a marked one
 * exactly - touching is enough, so a caller passing the raw hit against shifted ranges
 * still flags the right segment. Marked coverage matches
 * `splitTextByRanges`; only overlapping ranges segment differently (merged, not sliced
 * per range), which renders identically.
 */
export function splitTextByActiveRanges(
  text: string,
  ranges: TextRange[],
  activeRanges: TextRange[],
): ActiveTextSegment[] {
  const merged: { start: number; end: number }[] = [];
  for (const range of normalizeRanges(text, ranges)) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  if (merged.length === 0) return [{ text, marked: false, active: false }];
  const active = normalizeRanges(text, activeRanges);
  const overlapsActive = (start: number, end: number) =>
    active.some((range) => range.start < end && start < range.end);
  const segments: ActiveTextSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor)
      segments.push({ text: text.slice(cursor, range.start), marked: false, active: false });
    segments.push({
      text: text.slice(range.start, range.end),
      marked: true,
      active: overlapsActive(range.start, range.end),
    });
    cursor = range.end;
  }
  if (cursor < text.length)
    segments.push({ text: text.slice(cursor), marked: false, active: false });
  return segments;
}

/**
 * Split `text` into marked/unmarked segments for one set of ranges. Ranges are sorted,
 * clamped into the text, and empty or fully out-of-bounds ranges are dropped, so
 * callers can render the segments directly with no further checks.
 */
export function splitTextByRanges(text: string, ranges: TextRange[]): TextSegment[] {
  const usable = normalizeRanges(text, ranges);
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

export interface CommentTextSegment extends ActiveTextSegment {
  /** True when a comment excerpt touches the segment: tapping opens its thread. */
  comment: boolean;
}

/**
 * Split `text` by search `ranges` plus `commentRanges`, flagging what each
 * marked segment is: the current hit (`active`, drawn strong), a commented
 * passage (`comment`, tappable), or both. Marked coverage is the union, so a
 * passage that is both hit and commented renders one segment with both flags.
 */
export function splitTextByCommentRanges(
  text: string,
  ranges: TextRange[],
  commentRanges: TextRange[],
  activeRanges: TextRange[] = [],
): CommentTextSegment[] {
  const merged: { start: number; end: number }[] = [];
  const combined = [...normalizeRanges(text, ranges), ...normalizeRanges(text, commentRanges)].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  for (const range of combined) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  if (merged.length === 0)
    return [{ text, marked: false, active: false, comment: false }];
  const active = normalizeRanges(text, activeRanges);
  const commented = normalizeRanges(text, commentRanges);
  const overlaps = (list: { start: number; end: number }[], start: number, end: number) =>
    list.some((range) => range.start < end && start < range.end);
  const segments: CommentTextSegment[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor)
      segments.push({
        text: text.slice(cursor, range.start),
        marked: false,
        active: false,
        comment: false,
      });
    segments.push({
      text: text.slice(range.start, range.end),
      marked: true,
      active: overlaps(active, range.start, range.end),
      comment: overlaps(commented, range.start, range.end),
    });
    cursor = range.end;
  }
  if (cursor < text.length)
    segments.push({ text: text.slice(cursor), marked: false, active: false, comment: false });
  return segments;
}
