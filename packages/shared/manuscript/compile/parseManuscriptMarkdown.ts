import { parseInlineLine, type ManuscriptSpan } from '../ManuscriptDocument';

export type ManuscriptInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
};

export type ManuscriptBlock = { key: string; kind: 'paragraph'; inlines: ManuscriptInline[] };

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
 * `__`, `~~`), legacy `# ` prefixes and whole-line separators (`---`, `***`).
 * Fresh `#` is literal prose (the editor escapes it); only unescaped legacy
 * prefixes strip, mirroring the parser. Unmatched markers stay literal (and
 * counted), exactly as they render. Escaped literals (`\*`) count as their
 * char. Newlines are kept: they are prose structure, not markup.
 */
export function stripManuscriptMarkers(markdown: string): string {
  const stripped = protectEscapes(markdown)
    // Whole-line separators first: 3+ marker chars, optionally spaced
    // (`---`, `* * *`).
    .replace(/^(?:[ \t]*[*\-_]){3,}[ \t]*$/gm, '')
    // Legacy `# `/`## `/`### ` prefixes (a `#` without a trailing space is prose).
    .replace(/^#{1,3}[ \t]+(?=\S)/gm, '')
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

/**
 * Minimal manuscript markdown: `**bold**`, `*italic*`, `__underline__`,
 * `~~strikethrough~~`, backslash escapes, blank-line separated blocks. Single
 * newlines inside a block survive as their own inlines (dialogue lines),
 * unmatched markers stay literal, legacy `# ` prefixes degrade to plain
 * paragraphs. Deliberately dependency-free: prose needs nothing more, and a
 * new renderer dependency is a Hermes-compat risk for zero gain.
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
  return chunks.map((chunk, index) => {
    const key = `block-${index}`;
    const lines = chunk
      .replace(/^#{1,3}[ \t]+/, '')
      .replace(/\r\n?/g, '\n')
      .split('\n');
    const inlines: ManuscriptInline[] = [];
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) inlines.push({ text: '\n' });
      for (const span of parseInlineLine(line)) inlines.push(toInline(span));
    });
    return { key, kind: 'paragraph', inlines: mergeInlines(inlines) };
  });
}
