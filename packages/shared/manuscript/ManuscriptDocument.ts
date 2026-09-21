/**
 * Manuscript document model: styled runs as the source of truth, markdown only
 * as the storage serialization.
 *
 * The client editor and (later) the API publisher share this module. The editor
 * never shows markup characters: bold/italic/underline/strikethrough are span
 * metadata, literal `*`/`_`/`~`/`#` typed by the user is content (escaped on
 * serialize), and counts run on {@link documentTextContent}. Storage stays a
 * markdown string so drafts, sync, export and the 30k cap are untouched.
 *
 * Document invariant: a block's text holds no blank-line runs and no leading or
 * trailing newline (`parseMarkdownToDocument` guarantees this; the editing
 * engine must preserve it). Marks never cross block boundaries and never span
 * a single newline inside a block — matching the reader, which is single-line.
 */

export type ManuscriptMark = 'bold' | 'italic' | 'underline' | 'strikethrough';

export type ManuscriptSpan = {
  text: string;
  /** Sorted, unique. Empty means unstyled. */
  marks: ManuscriptMark[];
};

export type ManuscriptBlock =
  | { kind: 'paragraph'; spans: ManuscriptSpan[] }
  | { kind: 'heading'; level: 1 | 2 | 3; spans: ManuscriptSpan[] };

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

/** Normalizes every block and drops textless blocks. Pure, never mutates. */
export function normalizeManuscriptDocument(doc: ManuscriptDocument): ManuscriptDocument {
  const blocks: ManuscriptBlock[] = [];
  for (const block of doc.blocks) {
    const spans = normalizeManuscriptSpans(block.spans);
    if (spans.length === 0) continue;
    blocks.push(
      block.kind === 'heading'
        ? { kind: 'heading', level: block.level, spans }
        : { kind: 'paragraph', spans },
    );
  }
  return { blocks };
}

export function isEmptyManuscriptDocument(doc: ManuscriptDocument): boolean {
  return normalizeManuscriptDocument(doc).blocks.length === 0;
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
 */
function parseInlineLine(line: string): ManuscriptSpan[] {
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

const HEADING_PATTERN = /^(#{1,3})[ \t]+(.+)$/;

function parseChunk(chunk: string): ManuscriptBlock {
  const heading = HEADING_PATTERN.exec(chunk);
  const content = heading ? heading[2] : chunk;
  const spans = normalizeManuscriptSpans(
    content
      .split('\n')
      .flatMap((line, index) =>
        index === 0 ? parseInlineLine(line) : [{ text: '\n', marks: [] }, ...parseInlineLine(line)],
      ),
  );
  if (heading) {
    return { kind: 'heading', level: heading[1].length as 1 | 2 | 3, spans };
  }
  return { kind: 'paragraph', spans };
}

/** Parses stored markdown into a normalized document. Never throws. */
export function parseMarkdownToDocument(markdown: string): ManuscriptDocument {
  const chunks = markdown
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return normalizeManuscriptDocument({ blocks: chunks.map(parseChunk) });
}

type LineSegment = { text: string; marks: ManuscriptMark[] };

/** Detectors for "this raw text would parse markup of its own". */
const STAR_PAIR_PATTERN = /(\*[^*]+\*)|(\*\*.+?\*\*)/;
const UNDERSCORE_PAIR_PATTERN = /__.+?__/;
const TILDE_PAIR_PATTERN = /~~.+?~~/;
const PARAGRAPH_HEADING_PATTERN = /^#{1,3}[ \t]/;

function escapeLineSegments(segments: LineSegment[]): LineSegment[] {
  const raw = segments.map((segment) => segment.text).join('');
  const escapeStars =
    segments.some((segment) => segment.marks.includes('bold') || segment.marks.includes('italic')) ||
    STAR_PAIR_PATTERN.test(raw);
  const escapeUnderscores =
    segments.some((segment) => segment.marks.includes('underline')) || UNDERSCORE_PAIR_PATTERN.test(raw);
  const escapeTildes =
    segments.some((segment) => segment.marks.includes('strikethrough')) || TILDE_PAIR_PATTERN.test(raw);
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
  if (block.kind === 'heading') return `${'#'.repeat(block.level)} ${chunk}`;
  return PARAGRAPH_HEADING_PATTERN.test(chunk) ? `\\${chunk}` : chunk;
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
