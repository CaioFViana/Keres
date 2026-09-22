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
 * Body blocks are paragraphs only: scene and chapter titles live in their own
 * fields, never in the prose. Legacy `# ` prefixes degrade to plain paragraphs
 * on parse, so no stored content is ever lost.
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

export type ManuscriptBlock = { kind: 'paragraph'; spans: ManuscriptSpan[] };

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
      return { kind: 'paragraph' as const, spans: isTextlessSpans(spans) ? [] : spans };
    }),
  };
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
    const pair = line.slice(i, i + 2);
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
    if (pair === '__' || pair === '~~') {
      const mark: ManuscriptMark = pair === '__' ? 'underline' : 'strikethrough';
      if (current().marker === mark) closeTopFrame();
      else stack.push({ marker: mark, parts: [] });
      i += 2;
      continue;
    }
    pushText(current(), char);
    i += 1;
  }
  while (stack.length > 1) {
    const frame = stack.pop() as Frame;
    const marker = frame.marker as ManuscriptMark;
    current().parts.push({ text: MARKER[marker], marks: [] }, ...frame.parts);
  }
  return normalizeManuscriptSpans(stack[0].parts);
}

function parseChunkLines(lines: string[]): ManuscriptBlock {
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
  const blocks = flattened.split('\n\n').map((chunk) => {
    const lines = chunk.split('\n');
    while (lines.length > 0 && lines[0] === '') lines.shift();
    while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
    if (lines.length === 0) return { kind: 'paragraph' as const, spans: [] };
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

function emitBlock(block: ManuscriptBlock): string {
  const lines: LineSegment[][] = [[]];
  for (const span of block.spans) {
    const parts = span.text.split('\n');
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (part !== '') lines[lines.length - 1].push({ text: part, marks: span.marks });
    });
  }
  const chunk = lines.map(emitLine).join('\n');
  return LEADING_HASH_PATTERN.test(chunk) ? `\\${chunk}` : chunk;
}

/**
 * Serializes a normalized document to canonical markdown. Literal markup
 * characters in content are minimally escaped (only when they would otherwise
 * parse as markup), so stored bodies stay compact.
 */
export function serializeDocumentToMarkdown(doc: ManuscriptDocument): string {
  return normalizeManuscriptDocument(doc).blocks.map(emitBlock).join('\n\n');
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
