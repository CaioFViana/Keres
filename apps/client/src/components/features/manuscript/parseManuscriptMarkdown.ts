export type ManuscriptInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
};

export type ManuscriptBlock =
  | { key: string; kind: 'heading'; level: 1 | 2 | 3; inlines: ManuscriptInline[] }
  | { key: string; kind: 'paragraph'; inlines: ManuscriptInline[] };

type ManuscriptInlineStyle = 'bold' | 'italic' | 'underline' | 'strikethrough';

/**
 * Outermost level first. Styles never nest: a matched pair's content is a leaf,
 * and only the text between pairs recurses into the next level. The order
 * between non-nested styles is arbitrary but deterministic.
 */
const INLINE_LEVELS: { pattern: RegExp; style: ManuscriptInlineStyle }[] = [
  { pattern: /~~(.+?)~~/g, style: 'strikethrough' },
  { pattern: /__(.+?)__/g, style: 'underline' },
  { pattern: /\*\*(.+?)\*\*/g, style: 'bold' },
  { pattern: /\*([^*\n]+?)\*/g, style: 'italic' },
];

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

function parseLevel(segment: string, level: number, inlines: ManuscriptInline[]): void {
  if (level >= INLINE_LEVELS.length) {
    if (segment.length > 0) inlines.push({ text: restoreEscapes(segment) });
    return;
  }
  const { pattern, style } = INLINE_LEVELS[level];
  pattern.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(segment)) !== null) {
    if (match.index > cursor) {
      parseLevel(segment.slice(cursor, match.index), level + 1, inlines);
    }
    const span: ManuscriptInline = { text: restoreEscapes(match[1]) };
    span[style] = true;
    inlines.push(span);
    cursor = match.index + match[0].length;
  }
  if (cursor < segment.length) {
    parseLevel(segment.slice(cursor), level + 1, inlines);
  }
}

/**
 * Reader-visible text: the stored source minus the markdown markers (`**`, `*`,
 * `__`, `~~`, `# ` heading prefixes) and whole-line separators (`---`, `***`).
 * Mirrors the parser — only paired markers are formatting, so unmatched markers
 * stay literal (and counted), exactly as they render. Escaped literals (`\*`)
 * count as their char. Newlines are kept: they are prose structure, not markup.
 */
export function stripManuscriptMarkers(markdown: string): string {
  const stripped = protectEscapes(markdown)
    // Whole-line separators first: 3+ marker chars, optionally spaced
    // (`---`, `* * *`). Heading prefixes contain `#`, so they never match here.
    .replace(/^(?:[ \t]*[*\-_]){3,}[ \t]*$/gm, '')
    // `# `/`## `/`### ` heading prefixes (a `#` without a trailing space is prose).
    .replace(/^#{1,3}[ \t]+(?=\S)/gm, '')
    // Paired inline markers, `**` before `*` so bold pairs are not half-eaten.
    .replace(/__(.+?)__/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*([^*\n]+?)\*/g, '$1');
  return restoreEscapes(stripped);
}

/**
 * User-facing size bands, measured on the marker-stripped text. Storage still
 * caps at 30k source chars (server-validated); 27k leaves 3k of headroom so the
 * markers themselves always fit, and 20k is the early "consider splitting" nudge.
 */
export const MANUSCRIPT_LARGE_SCENE_CHARS = 20000;
export const MANUSCRIPT_TOO_LARGE_SCENE_CHARS = 27000;

export type ManuscriptSizeStatus = 'ok' | 'large' | 'tooLarge';

/** Above 20k suggests a split; reaching 27k is too large. Boundary-exact. */
export function getManuscriptSizeStatus(visibleCharCount: number): ManuscriptSizeStatus {
  if (visibleCharCount >= MANUSCRIPT_TOO_LARGE_SCENE_CHARS) return 'tooLarge';
  if (visibleCharCount > MANUSCRIPT_LARGE_SCENE_CHARS) return 'large';
  return 'ok';
}

/**
 * Minimal manuscript markdown: `#`/`##`/`###` headings, `**bold**`, `*italic*`,
 * `__underline__`, `~~strikethrough~~`, backslash escapes, blank-line separated
 * blocks. Single newlines inside a block are preserved (dialogue lines),
 * unmatched markers stay literal, styles never nest. Deliberately
 * dependency-free: prose needs nothing more, and a new renderer dependency is
 * a Hermes-compat risk for zero gain.
 */
export function parseManuscriptMarkdown(markdown: string): ManuscriptBlock[] {
  const chunks = markdown
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.map((chunk, index) => {
    const key = `block-${index}`;
    const heading = /^(#{1,3})\s+(.+)$/.exec(chunk);
    if (heading) {
      const inlines: ManuscriptInline[] = [];
      parseLevel(protectEscapes(heading[2]), 0, inlines);
      return {
        key,
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        inlines,
      };
    }
    const inlines: ManuscriptInline[] = [];
    parseLevel(protectEscapes(chunk), 0, inlines);
    return { key, kind: 'paragraph', inlines };
  });
}
