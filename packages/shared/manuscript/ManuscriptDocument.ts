/**
 * Manuscript document model: styled runs as the source of truth, markdown only
 * as the storage serialization.
 *
 * The client editor and (later) the API publisher share this module. The editor
 * never shows markup characters: bold/italic/underline/strikethrough are span
 * metadata, literal `*`/`_`/`~` typed by the user is content (escaped on
 * serialize when it would otherwise parse as markup), `#` is always literal
 * prose, and counts run on {@link documentTextContent}. Storage stays a
 * markdown string so drafts, sync, export and the 30k cap are untouched.
 *
 * Body blocks are paragraphs or single-line list items: scene and chapter titles
 * live in their own fields, never in the prose. Legacy `# ` prefixes degrade
 * to plain paragraphs on parse, so no stored content is ever lost. List items
 * (`- `, `1. `) keep their marker as structure: a paragraph that would read
 * as one is stored backslash-escaped (`\- `, `\1. `).
 *
 * Document invariant: a block's text holds no blank-line runs and no leading or
 * trailing newline (`parseMarkdownToDocument` guarantees this; the editing
 * engine must preserve it). Marks never cross block boundaries and never span
 * a single newline inside a block — matching the reader, which is single-line.
 * Blocks may be empty (`spans: []`): blank lines between or around prose,
 * preserved byte-identically through storage so consecutive Enters survive a
 * save round-trip and count in the text like the final output counts them.
 */

export type ManuscriptMark = 'bold' | 'italic' | 'underline' | 'strikethrough';

export type ManuscriptSpan = {
  text: string;
  /** Sorted, unique. Empty means unstyled. */
  marks: ManuscriptMark[];
};

export type ManuscriptBlock =
  | { kind: 'paragraph'; spans: ManuscriptSpan[] }
  | { kind: 'bullet'; spans: ManuscriptSpan[] }
  | { kind: 'ordered'; index: number; spans: ManuscriptSpan[] };

export type ManuscriptDocument = { blocks: ManuscriptBlock[] };

/** Canonical mark order: sorting spans and (reversed) serialization nesting. */
const MARK_ORDER: readonly ManuscriptMark[] = ['bold', 'italic', 'underline', 'strikethrough'];

const MARKER: Record<ManuscriptMark, string> = {
  bold: '**',
  italic: '*',
  underline: '__',
  strikethrough: '~~',
};

/** Serialization wraps outside-in in this order, so output is deterministic. */
const SERIALIZE_OUTER_FIRST: readonly ManuscriptMark[] = [
  'strikethrough',
  'underline',
  'bold',
  'italic',
];
const SERIALIZE_INNER_FIRST: readonly ManuscriptMark[] = [...SERIALIZE_OUTER_FIRST].reverse();

const ESCAPABLE = new Set(['\\', '*', '_', '~', '#']);

function sortMarks(marks: ManuscriptMark[]): ManuscriptMark[] {
  return [...new Set(marks)].sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b));
}

function sameMarks(a: ManuscriptMark[], b: ManuscriptMark[]): boolean {
  return a.length === b.length && a.every((mark, index) => mark === b[index]);
}

/**
 * Drops empty spans, sorts/dedupes marks, merges adjacent same-mark spans.
 * Newlines split out of marked spans: marks never sit on `\n` (they would not
 * survive line-based serialization, and render nothing either way).
 */
export function normalizeManuscriptSpans(spans: ManuscriptSpan[]): ManuscriptSpan[] {
  const out: ManuscriptSpan[] = [];
  const feed = (text: string, marks: ManuscriptMark[]) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && sameMarks(last.marks, marks)) {
      last.text += text;
    } else {
      out.push({ text, marks });
    }
  };
  for (const span of spans) {
    const marks = sortMarks(span.marks);
    span.text.split('\n').forEach((segment, index) => {
      if (index > 0) feed('\n', []);
      feed(segment, marks);
    });
  }
  return out;
}

/** A block with no visible text: empty or whitespace/newlines only. */
function isTextlessSpans(spans: ManuscriptSpan[]): boolean {
  return spans.every((span) => span.text.trim() === '');
}

/**
 * Normalizes every block, keeping textless ones as canonical empty blocks
 * (`spans: []`) so blank lines survive. Pure, never mutates.
 */
export function normalizeManuscriptDocument(doc: ManuscriptDocument): ManuscriptDocument {
  return {
    blocks: doc.blocks.map((block) => {
      const spans = normalizeManuscriptSpans(block.spans);
      const empty: ManuscriptSpan[] = [];
      const kept = isTextlessSpans(spans) ? empty : spans;
      if (block.kind === 'ordered')
        return { kind: 'ordered' as const, index: clampListIndex(block.index), spans: kept };
      return { kind: block.kind, spans: kept };
    }),
  };
}

/** Ordered markers keep the typed number, clamped to a sane range. */
export function clampListIndex(index: number): number {
  if (!Number.isFinite(index)) return 1;
  return Math.min(9999, Math.max(1, Math.floor(index)));
}

/** A stored marker backslash-escaped, so it reads as literal prose. */
const LIST_ESCAPE_PATTERN = /^ {0,3}\\(- |\d{1,9}\. )/;

/** Drops one escape backslash, keeping any indent: `  \- x` reads as `  - x`. */
export function unescapeListMarker(line: string): string {
  return line.replace(/^(\s{0,3})\\(- |\d{1,9}\. )/, '$1$2');
}

/** Strips one list marker for reader-visible text (`- x` reads as `x`). */
export function stripListMarker(line: string): string {
  if (LIST_ESCAPE_PATTERN.test(line)) return unescapeListMarker(line);
  return line.replace(/^ {0,3}(?:- |\d{1,9}\. )/, '');
}

/** Whether this raw line opens a list item (and which kind). A bare `-` or `1.` is an empty item. */
function listMarkerOf(
  line: string,
): { kind: 'bullet' } | { kind: 'ordered'; index: number } | null {
  if (LIST_ESCAPE_PATTERN.test(line)) return null;
  if (/^ {0,3}- ?$/.test(line)) return { kind: 'bullet' };
  const bullet = line.match(/^ {0,3}- (.*)$/);
  if (bullet) return { kind: 'bullet' };
  const bareOrdered = line.match(/^ {0,3}(\d{1,9})\.$/);
  if (bareOrdered) return { kind: 'ordered', index: clampListIndex(Number(bareOrdered[1])) };
  const ordered = line.match(/^ {0,3}(\d{1,9})\. (.*)$/);
  if (ordered) return { kind: 'ordered', index: clampListIndex(Number(ordered[1])) };
  return null;
}

export function isEmptyManuscriptDocument(doc: ManuscriptDocument): boolean {
  return normalizeManuscriptDocument(doc).blocks.every((block) => block.spans.length === 0);
}

type Frame = { marker: ManuscriptMark | null; parts: ManuscriptSpan[] };

function pushText(frame: Frame, text: string): void {
  const last = frame.parts[frame.parts.length - 1];
  if (last && last.marks.length === 0) {
    last.text += text;
  } else {
    frame.parts.push({ text, marks: [] });
  }
}

/**
 * Single-line inline parse. Stack machine: a marker matching the top frame
 * closes it, anything else opens a new frame, so distinct markers nest
 * (`**__x__**`, `***x***`) while same-marker overlaps degrade to literal.
 * Backslash escapes one escapable char; unclosed openers and empty pairs
 * (`****`) stay literal, like the reader.
 *
 * Shared with the export reader, so compiled manuscripts style exactly what
 * the app shows: one inline grammar, two span shapes.
 */
export function parseInlineLine(line: string): ManuscriptSpan[] {
  const stack: Frame[] = [{ marker: null, parts: [] }];
  const current = () => stack[stack.length - 1];
  const closeTopFrame = () => {
    const frame = stack.pop() as Frame;
    const mark = frame.marker as ManuscriptMark;
    const inner = normalizeManuscriptSpans(frame.parts);
    if (inner.length === 0) {
      pushText(current(), MARKER[mark] + MARKER[mark]);
    } else {
      current().parts.push(...inner.map((span) => ({ ...span, marks: [...span.marks, mark] })));
    }
  };
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === '\\' && i + 1 < line.length && ESCAPABLE.has(line[i + 1])) {
      pushText(current(), line[i + 1]);
      i += 2;
      continue;
    }
    // Stars are ambiguous (`***` opens bold-then-italic but closes
    // italic-then-bold), so an open italic frame always claims a single star
    // as its closer instead of letting `**` match greedily.
    if (char === '*') {
      if (current().marker === 'italic') {
        closeTopFrame();
        i += 1;
        continue;
      }
      if (line[i + 1] === '*') {
        if (current().marker === 'bold') closeTopFrame();
        else stack.push({ marker: 'bold', parts: [] });
        i += 2;
        continue;
      }
      stack.push({ marker: 'italic', parts: [] });
      i += 1;
      continue;
    }
    if ((char === '_' || char === '~') && line[i + 1] === char) {
      const mark: ManuscriptMark = char === '_' ? 'underline' : 'strikethrough';
      if (current().marker === mark) closeTopFrame();
      else stack.push({ marker: mark, parts: [] });
      i += 2;
      continue;
    }
    // Plain run: consecutive chars that can never open markup merge into the
    // same unmarked span either way, so consume them in one slice instead of
    // one pushText per char (a 15MB unstyled line must parse in milliseconds).
    // Lone `_`, `~` and `\` are literal, so the run starts at `i` itself and
    // only stops before a char that may start a marker or an escape.
    let j = i + 1;
    while (j < line.length) {
      const next = line[j];
      if (next === '\\' || next === '*' || next === '_' || next === '~') break;
      j += 1;
    }
    pushText(current(), line.slice(i, j));
    i = j;
  }
  while (stack.length > 1) {
    const frame = stack.pop() as Frame;
    const marker = frame.marker as ManuscriptMark;
    current().parts.push({ text: MARKER[marker], marks: [] }, ...frame.parts);
  }
  return normalizeManuscriptSpans(stack[0].parts);
}

type StripFrame = {
  marker: ManuscriptMark;
  openAt: number;
  openLength: number;
  /** Nested consumed units inside this frame: raw inside minus these means content. */
  innerConsumed: number;
};

/**
 * Rendered text of one inline line: consumed markers and escape backslashes
 * removed, everything else byte-identical. Mirrors `parseInlineLine` decision
 * for decision (same stack, same closer rules, same empty-pair and
 * unclosed-opener literals), so the result always equals the parsed spans
 * joined - previews show exactly what the reader shows. Single line only, like
 * the reader: markup never spans a newline.
 */
export function stripInlineMarkup(line: string): string {
  // Pass 1: run the machine, recording consumed raw spans. A close with content
  // consumes its open and close markers; an empty close (`****`) stays literal,
  // exactly like the reader pushing the markers back as text. Unclosed openers
  // record nothing, so they read back literal too.
  const consumed: { start: number; length: number }[] = [];
  const stack: StripFrame[] = [];
  const top = () => stack[stack.length - 1];
  const closeTop = (closeAt: number, closeLength: number) => {
    const frame = stack.pop() as StripFrame;
    const innerRaw = closeAt - (frame.openAt + frame.openLength);
    if (innerRaw - frame.innerConsumed > 0) {
      consumed.push(
        { start: frame.openAt, length: frame.openLength },
        { start: closeAt, length: closeLength },
      );
      for (const enclosing of stack) enclosing.innerConsumed += frame.openLength + closeLength;
    }
  };
  let i = 0;
  while (i < line.length) {
    const char = line[i];
    if (char === '\\' && i + 1 < line.length && ESCAPABLE.has(line[i + 1])) {
      consumed.push({ start: i, length: 1 });
      i += 2;
      continue;
    }
    if (char === '*') {
      if (top()?.marker === 'italic') {
        closeTop(i, 1);
        i += 1;
        continue;
      }
      if (line[i + 1] === '*') {
        if (top()?.marker === 'bold') closeTop(i, 2);
        else stack.push({ marker: 'bold', openAt: i, openLength: 2, innerConsumed: 0 });
        i += 2;
        continue;
      }
      stack.push({ marker: 'italic', openAt: i, openLength: 1, innerConsumed: 0 });
      i += 1;
      continue;
    }
    if ((char === '_' || char === '~') && line[i + 1] === char) {
      const mark: ManuscriptMark = char === '_' ? 'underline' : 'strikethrough';
      if (top()?.marker === mark) closeTop(i, 2);
      else stack.push({ marker: mark, openAt: i, openLength: 2, innerConsumed: 0 });
      i += 2;
      continue;
    }
    i += 1;
  }
  // Nested closes record inner spans before outer ones: sort for the emit pass.
  consumed.sort((a, b) => a.start - b.start || a.length - b.length);
  // Pass 2: emit every raw unit outside a consumed span.
  let text = '';
  let cursor = 0;
  for (const span of consumed) {
    text += line.slice(cursor, span.start);
    cursor = Math.max(cursor, span.start + span.length);
  }
  return text + line.slice(cursor);
}

/**
 * Rendered text of a whole markdown field: each line stripped, newlines (and
 * blank lines) preserved byte-identically. Comment previews show this instead
 * of the raw serialization, so no markup symbol ever leaks into them.
 */
export function stripMarkdownText(markdown: string): string {
  return markdown
    .split('\n')
    .map((line) => stripInlineMarkup(stripListMarker(line)))
    .join('\n');
}

function paragraphFromLines(lines: string[]): ManuscriptBlock {
  // Legacy `# ` prefixes (pre-removal headings) degrade to plain paragraphs.
  const [first, ...rest] = lines;
  const content = [first.replace(/^#{1,3}[ \t]+/, ''), ...rest];
  const spans = normalizeManuscriptSpans(
    content.flatMap((line, index) =>
      index === 0 ? parseInlineLine(line) : [{ text: '\n', marks: [] }, ...parseInlineLine(line)],
    ),
  );
  return { kind: 'paragraph', spans };
}

function listItemRest(line: string): string {
  const withContent = line.match(/^ {0,3}(?:- |\d{1,9}\. )(.*)$/);
  if (withContent) return withContent[1];
  if (/^ {0,3}(?:-|\d{1,9}\.)$/.test(line)) return '';
  return line;
}

function listItemBlock(
  marker: { kind: 'bullet' } | { kind: 'ordered'; index: number },
  line: string,
): ManuscriptBlock {
  const rest = listItemRest(line);
  const spans = rest === '' ? [] : normalizeManuscriptSpans(parseInlineLine(rest));
  if (marker.kind === 'ordered') return { kind: 'ordered', index: marker.index, spans };
  return { kind: 'bullet', spans };
}

function parseChunkLines(lines: string[]): ManuscriptBlock[] {
  const blocks: ManuscriptBlock[] = [];
  let pending: string[] = [];
  const flushPending = () => {
    if (pending.length > 0) {
      blocks.push(paragraphFromLines(pending));
      pending = [];
    }
  };
  for (const line of lines) {
    // An escaped marker is literal prose: drop one backslash, keep the text.
    if (LIST_ESCAPE_PATTERN.test(line)) {
      pending.push(unescapeListMarker(line));
      continue;
    }
    const marker = listMarkerOf(line);
    if (marker) {
      flushPending();
      blocks.push(listItemBlock(marker, line));
      continue;
    }
    pending.push(line);
  }
  flushPending();
  return blocks;
}

const BLANK_LINE_PATTERN = /^[ \t]*$/;

/**
 * Parses stored markdown into a normalized document. Never throws.
 *
 * Blank-line runs stay blank lines: each `\n\n` separator is a block boundary
 * and blank lines beyond the first form empty blocks, so `a\n\n\n\nb` reads
 * back the gap the serializer wrote, byte-identically. Space-only lines are
 * layout noise and fold into plain blank lines first.
 */
export function parseMarkdownToDocument(markdown: string): ManuscriptDocument {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  if (normalized.trim() === '') return { blocks: [] };
  const flattened = normalized
    .split('\n')
    .map((line) => (BLANK_LINE_PATTERN.test(line) ? '' : line))
    .join('\n');
  const blocks = flattened.split('\n\n').flatMap((chunk) => {
    const lines = chunk.split('\n');
    while (lines.length > 0 && lines[0] === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    if (lines.length === 0) return [{ kind: 'paragraph' as const, spans: [] }];
    lines[0] = lines[0].replace(/^[ \t]+/, '');
    lines[lines.length - 1] = lines[lines.length - 1].replace(/[ \t]+$/, '');
    return parseChunkLines(lines);
  });
  return normalizeManuscriptDocument({ blocks });
}

type LineSegment = { text: string; marks: ManuscriptMark[] };

/** Detectors for "this raw text would parse markup of its own". */
const STAR_PAIR_PATTERN = /(\*[^*]+\*)|(\*\*.+?\*\*)/;
const UNDERSCORE_PAIR_PATTERN = /__.+?__/;
const TILDE_PAIR_PATTERN = /~~.+?~~/;
/** A literal leading `# ` would be stripped as a legacy heading: escape it. */
const LEADING_HASH_PATTERN = /^#{1,3}[ \t]/;

function escapeLineSegments(segments: LineSegment[]): LineSegment[] {
  const raw = segments.map((segment) => segment.text).join('');
  const escapeStars =
    segments.some(
      (segment) => segment.marks.includes('bold') || segment.marks.includes('italic'),
    ) || STAR_PAIR_PATTERN.test(raw);
  const escapeUnderscores =
    segments.some((segment) => segment.marks.includes('underline')) ||
    UNDERSCORE_PAIR_PATTERN.test(raw);
  const escapeTildes =
    segments.some((segment) => segment.marks.includes('strikethrough')) ||
    TILDE_PAIR_PATTERN.test(raw);
  return segments.map((segment) => {
    let text = segment.text.replace(/\\(?=[\\*_~#])/g, '\\\\');
    if (escapeStars) text = text.replace(/\*/g, '\\*');
    if (escapeUnderscores) text = text.replace(/_/g, '\\_');
    if (escapeTildes) text = text.replace(/~/g, '\\~');
    return { text, marks: segment.marks };
  });
}

function emitLine(segments: LineSegment[]): string {
  return escapeLineSegments(segments)
    .map((segment) => {
      let text = segment.text;
      for (const mark of SERIALIZE_INNER_FIRST) {
        if (segment.marks.includes(mark)) text = `${MARKER[mark]}${text}${MARKER[mark]}`;
      }
      return text;
    })
    .join('');
}

/**
 * Escapes one paragraph line so it never reads back as structure: a legacy
 * heading on the first line, a list marker on any line (every line is
 * list-checked on parse). The backslash lands after any indent, where the
 * parser's escape pattern expects it.
 */
function escapeParagraphLine(line: string, isFirst: boolean): string {
  let out = line;
  if (isFirst && LEADING_HASH_PATTERN.test(out)) out = `\\${out}`;
  out = out.replace(/^(\s{0,3})(- |\d{1,9}\. )/, '$1\\$2');
  return out;
}

function emitBlock(block: ManuscriptBlock): string {
  const lines: LineSegment[][] = [[]];
  for (const span of block.spans) {
    const parts = span.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part !== '') lines[lines.length - 1].push({ text: part, marks: span.marks });
    });
  }
  // List items are single-line by construction; a stray break degrades to a
  // space so the marker can never leak onto its own line.
  if (block.kind === 'bullet' || block.kind === 'ordered') {
    const text = lines.map(emitLine).join(' ').replace(/\s+/g, ' ').trim();
    if (text === '') return block.kind === 'bullet' ? '-' : `${block.index}.`;
    return block.kind === 'bullet' ? `- ${text}` : `${clampListIndex(block.index)}. ${text}`;
  }
  return lines
    .map(emitLine)
    .map((line, index) => escapeParagraphLine(line, index === 0))
    .join('\n');
}

/**
 * Serializes a normalized document to canonical markdown. Literal markup
 * characters in content are minimally escaped (only when they would otherwise
 * parse as markup), so stored bodies stay compact.
 */
export function serializeDocumentToMarkdown(doc: ManuscriptDocument): string {
  const blocks = normalizeManuscriptDocument(doc).blocks;
  const joinsList = (kind: ManuscriptBlock['kind']): boolean =>
    kind === 'bullet' || kind === 'ordered';
  let out = '';
  blocks.forEach((block, index) => {
    // Adjacent items of one list share it without blank lines, exactly as
    // typed; anything else (including a change of list kind) separates.
    const prev = index > 0 ? blocks[index - 1].kind : null;
    if (index > 0) out += prev === block.kind && joinsList(block.kind) ? '\n' : '\n\n';
    out += emitBlock(block);
  });
  return out;
}

/**
 * The reader-visible text: span contents joined, blocks separated by a blank
 * line. Feeds the editing surface and the user-facing counts — markup is
 * metadata here, never characters.
 */
export function documentTextContent(doc: ManuscriptDocument): string {
  return normalizeManuscriptDocument(doc)
    .blocks.map((block) => block.spans.map((span) => span.text).join(''))
    .join('\n\n');
}
