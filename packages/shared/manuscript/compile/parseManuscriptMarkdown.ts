import { parseInlineLine, type ManuscriptSpan } from '../ManuscriptDocument';

export type ManuscriptInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
};

export type ManuscriptBlock =
  | { key: string; kind: 'paragraph'; inlines: ManuscriptInline[] }
  | { key: string; kind: 'bullet'; inlines: ManuscriptInline[] }
  | { key: string; kind: 'ordered'; index: number; inlines: ManuscriptInline[] };

/** Reader spans to flat export inlines: only true flags are set. */
function toInline(span: ManuscriptSpan): ManuscriptInline {
  const inline: ManuscriptInline = { text: span.text };
  if (span.marks.includes('bold')) inline.bold = true;
  if (span.marks.includes('italic')) inline.italic = true;
  if (span.marks.includes('underline')) inline.underline = true;
  if (span.marks.includes('strikethrough')) inline.strikethrough = true;
  return inline;
}

function sameFlags(left: ManuscriptInline, right: ManuscriptInline): boolean {
  return (
    (left.bold ?? false) === (right.bold ?? false) &&
    (left.italic ?? false) === (right.italic ?? false) &&
    (left.underline ?? false) === (right.underline ?? false) &&
    (left.strikethrough ?? false) === (right.strikethrough ?? false)
  );
}

/** Merge adjacent same-flag inlines, like the reader's normalize step. */
function mergeInlines(inlines: ManuscriptInline[]): ManuscriptInline[] {
  const merged: ManuscriptInline[] = [];
  for (const inline of inlines) {
    const last = merged[merged.length - 1];
    if (last && sameFlags(last, inline)) last.text += inline.text;
    else merged.push({ ...inline });
  }
  return merged;
}

/**
 * Backslash escapes (`\*`, `\\`, ...) the editor serializer emits for literal
 * markup characters. While the level regexes run, escapes hide behind
 * private-use stand-ins none of those patterns can match or cross; the
 * original chars are restored on the way out. Five codepoints (U+E000–E004)
 * are reserved for this and never occur in prose.
 */
const ESCAPED_TO_STANDIN: Record<string, string> = {
  '*': '\uE000',
  _: '\uE001',
  '~': '\uE002',
  '#': '\uE003',
  '\\': '\uE004',
};
const STANDIN_TO_ESCAPED: Record<string, string> = {
  '\uE000': '*',
  '\uE001': '_',
  '\uE002': '~',
  '\uE003': '#',
  '\uE004': '\\',
};
const STANDIN_RANGE = /[\uE000-\uE004]/g;

function protectEscapes(text: string): string {
  return text.replace(/\\([\\*_~#])/g, (_match, char: string) => ESCAPED_TO_STANDIN[char]);
}

function restoreEscapes(text: string): string {
  return text.replace(STANDIN_RANGE, (char) => STANDIN_TO_ESCAPED[char]);
}

/**
 * Reader-visible text: the stored source minus the markdown markers (`**`, `*`,
 * `__`, `~~`), legacy `# ` prefixes, list markers (`- `, `1. `) and
 * whole-line separators (`---`, `***`). Fresh `#` is literal prose (the editor
 * escapes it); only unescaped legacy prefixes strip, mirroring the parser.
 * Unmatched markers stay literal (and counted), exactly as they render.
 * Escaped literals (`\*`) count as their char. Newlines are kept: they are
 * prose structure, not markup.
 */
export function stripManuscriptMarkers(markdown: string): string {
  const stripped = protectEscapes(markdown)
    // Whole-line separators first: 3+ marker chars, optionally spaced
    // (`---`, `* * *`).
    .replace(/^(?:[ \t]*[*\-_]){3,}[ \t]*$/gm, '')
    // Legacy `# `/`## `/`### ` prefixes (a `#` without a trailing space is prose).
    .replace(/^#{1,3}[ \t]+(?=\S)/gm, '')
    // List markers: unescaped ones are structure, escaped ones keep one literal char.
    .replace(/^ {0,3}(?:- |\d{1,9}\. )/gm, '')
    .replace(/^(\s{0,3})\\(- |\d{1,9}\. )/gm, '$1$2')
    // Paired inline markers, `**` before `*` so bold pairs are not half-eaten.
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1');
  return restoreEscapes(stripped);
}

/**
 * User-facing character count: visible characters with every line break —
 * soft breaks and blank-line paragraph separators alike — counting once, the
 * way Word counts paragraph marks. Markup never reaches this number: bold,
 * italic and friends count toward the storage budget instead.
 */
export function countManuscriptDisplayChars(text: string): number {
  return text.replace(/\n\n/g, '\n').length;
}

/**
 * The scene-length warning, measured on serialized storage chars (what the
 * backend persists, markers/escapes/breaks included) — never on the displayed
 * count, which markup would understate. At 20k the footer warns the scene is
 * getting long; typing itself blocks at the 30k storage cap. No number is ever
 * shown to the user. Boundary-exact.
 */
export const MANUSCRIPT_LARGE_SCENE_CHARS = 20000;

export type ManuscriptSizeStatus = 'ok' | 'large';

/** At 20k storage chars the scene counts as long. Boundary-exact. */
export function getManuscriptSizeStatus(storageCharCount: number): ManuscriptSizeStatus {
  if (storageCharCount >= MANUSCRIPT_LARGE_SCENE_CHARS) return 'large';
  return 'ok';
}

/** A stored marker backslash-escaped, so it reads as literal prose. */
const LIST_ESCAPE_PATTERN = /^ {0,3}\\(- |\d{1,9}\. )/;

function clampListIndex(index: number): number {
  if (!Number.isFinite(index)) return 1;
  return Math.min(9999, Math.max(1, Math.floor(index)));
}

/** Whether this raw line opens a list item (and which kind). */
function listMarkerOf(
  line: string,
): { kind: 'bullet' } | { kind: 'ordered'; index: number } | null {
  if (LIST_ESCAPE_PATTERN.test(line)) return null;
  if (/^ {0,3}- ?$/.test(line)) return { kind: 'bullet' };
  if (/^ {0,3}- (.*)$/.test(line)) return { kind: 'bullet' };
  const bareOrdered = line.match(/^ {0,3}(\d{1,9})\.$/);
  if (bareOrdered) return { kind: 'ordered', index: clampListIndex(Number(bareOrdered[1])) };
  const ordered = line.match(/^ {0,3}(\d{1,9})\. (.*)$/);
  if (ordered) return { kind: 'ordered', index: clampListIndex(Number(ordered[1])) };
  return null;
}

function listItemRest(line: string): string {
  const withContent = line.match(/^ {0,3}(?:- |\d{1,9}\. )(.*)$/);
  if (withContent) return withContent[1];
  if (/^ {0,3}(?:-|\d{1,9}\.)$/.test(line)) return '';
  return line;
}

function parseInlineLines(lines: string[]): ManuscriptInline[] {
  const inlines: ManuscriptInline[] = [];
  lines.forEach((line, lineIndex) => {
    if (lineIndex > 0) inlines.push({ text: '\n' });
    for (const span of parseInlineLine(line)) inlines.push(toInline(span));
  });
  return mergeInlines(inlines);
}

/**
 * Minimal manuscript markdown: `**bold**`, `*italic*`, `__underline__`,
 * `~~strikethrough~~`, `- `/`1. ` list items, backslash escapes, blank-line
 * separated blocks. Single newlines inside a block survive as their own
 * inlines (dialogue lines), unmatched markers stay literal, legacy `# `
 * prefixes degrade to plain paragraphs. Deliberately dependency-free: prose
 * needs nothing more, and a new renderer dependency is a Hermes-compat risk
 * for zero gain.
 *
 * Inline parsing IS the reader's: every line runs through the app's own stack
 * machine, so the export styles exactly what the app shows (nesting
 * included) and only the span shape differs (flat inlines vs. marked runs).
 */
export function parseManuscriptMarkdown(markdown: string): ManuscriptBlock[] {
  const chunks = markdown
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const blocks: ManuscriptBlock[] = [];
  let counter = 0;
  const push = (
    block:
      | { kind: 'paragraph'; inlines: ManuscriptInline[] }
      | { kind: 'bullet'; inlines: ManuscriptInline[] }
      | { kind: 'ordered'; index: number; inlines: ManuscriptInline[] },
  ) => {
    blocks.push({ ...block, key: `block-${counter}` });
    counter += 1;
  };
  for (const chunk of chunks) {
    const lines = chunk.replace(/\r\n?/g, '\n').split('\n');
    let pending: string[] = [];
    // Whether the pending paragraph opens the chunk: only then does the
    // legacy `# ` prefix degrade (a `# ` mid-chunk stays literal, as before).
    let pendingFromStart = false;
    const flushPending = () => {
      if (pending.length === 0) return;
      const [first, ...rest] = pending;
      const content = pendingFromStart
        ? [first.replace(/^#{1,3}[ \t]+/, ''), ...rest]
        : [first, ...rest];
      push({ kind: 'paragraph', inlines: parseInlineLines(content) });
      pending = [];
      pendingFromStart = false;
    };
    let chunkStart = true;
    for (const line of lines) {
      if (LIST_ESCAPE_PATTERN.test(line)) {
        if (chunkStart) pendingFromStart = true;
        pending.push(line.replace(/^(\s{0,3})\\(- |\d{1,9}\. )/, '$1$2'));
        chunkStart = false;
        continue;
      }
      const marker = listMarkerOf(line);
      if (marker) {
        flushPending();
        chunkStart = false;
        const rest = listItemRest(line);
        const inlines = rest === '' ? [] : parseInlineLines([rest]);
        if (marker.kind === 'ordered') push({ kind: 'ordered', index: marker.index, inlines });
        else push({ kind: 'bullet', inlines });
        continue;
      }
      if (chunkStart) pendingFromStart = true;
      pending.push(line);
      chunkStart = false;
    }
    flushPending();
  }
  return blocks;
}
