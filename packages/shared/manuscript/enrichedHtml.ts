import {
  normalizeManuscriptDocument,
  normalizeManuscriptSpans,
  type ManuscriptDocument,
  type ManuscriptMark,
  type ManuscriptSpan,
} from './ManuscriptDocument';

/**
 * Storage boundary between the manuscript document model and the
 * `react-native-enriched-html` editor, whose source of truth is HTML.
 *
 * Canonical tags mirror the editor's supported set: `<p>` paragraphs
 * (an empty `<p></p>` is a blank line), `<b>`/`<i>`/`<u>`/`<s>` inline marks.
 * A bare `<br>` between blocks is the host's empty-paragraph encoding (it
 * emits `<p></p>` as `<br>`); a `<br>` after text stays a soft break. Nothing
 * else the editor can produce (headings, lists, links, … — reachable via
 * paste) survives as structure: prose text is never lost, structure outside
 * the model degrades to plain paragraphs. Unknown tags, comments, scripts
 * and styles are dropped the same way.
 *
 * The emitter never writes `<br>`: the host rewrites interior `<br>` into
 * paragraph splits plus phantom empties when seeding (proven against the real
 * build), so soft lines promote to paragraphs on emit. Soft breaks survive
 * live typing and storage, and canonicalize to paragraphs on the next reseed.
 */

const TAG_TO_MARK: Record<string, ManuscriptMark> = {
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  u: 'underline',
  ins: 'underline',
  s: 'strikethrough',
  strike: 'strikethrough',
  del: 'strikethrough',
};

const MARK_TO_TAG: Record<ManuscriptMark, string> = {
  bold: 'b',
  italic: 'i',
  underline: 'u',
  strikethrough: 's',
};

/** Same outside-in nesting as the markdown serializer, so output is canonical. */
const HTML_OUTER_FIRST: readonly ManuscriptMark[] = [
  'strikethrough',
  'underline',
  'bold',
  'italic',
];

/** Block containers that degrade to plain paragraphs (text kept, structure dropped). */
const BLOCK_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'ul',
  'ol',
  'li',
  'codeblock',
  'div',
  'pre',
  'section',
  'article',
  'header',
  'footer',
  'main',
]);

/** Elements whose entire subtree is dropped. */
const SKIP_TAGS = new Set(['script', 'style', 'head']);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#x[\da-fA-F]+|\w+);/g, (entity, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isNaN(code) ? entity : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body] ?? entity;
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const NEWLINE_STANDIN = '\u0000';

type RawSpan = { text: string; marks: ManuscriptMark[] };

/**
 * Parses editor HTML into a document. Tolerant by design: malformed, pasted or
 * foreign markup degrades to paragraphs instead of throwing or losing prose.
 */
export function enrichedHtmlToDocument(html: string): ManuscriptDocument {
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const tokens = withoutComments.split(/(<[^<>]*>)/g);
  const blocks: ManuscriptSpan[][] = [];
  let current: RawSpan[] = [];
  let marks: ManuscriptMark[] = [];
  let skipDepth = 0;
  // Set by a block open, cleared by any significant content: lets a close
  // tell an explicit `<p></p>` (blank line) from pretty-printing whitespace.
  let pendingEmpty = false;
  const hasSignificantContent = () =>
    current.some((span) => span.text === NEWLINE_STANDIN || /\S/.test(span.text));

  const flushBlock = () => {
    // Raw newlines are pretty-printing (real breaks arrive as `<br>`
    // stand-ins); edge whitespace of the block is dropped like the markdown
    // parser trims chunks.
    const cleaned: RawSpan[] = [];
    current.forEach((span, spanIndex) => {
      let text = span.text.replace(/[ \t]*\r?\n[ \t]*/g, ' ');
      if (spanIndex === 0) text = text.replace(/^\s+/, '');
      if (spanIndex === current.length - 1) text = text.replace(/\s+$/, '');
      text.split(NEWLINE_STANDIN).forEach((chunk, chunkIndex) => {
        if (chunkIndex > 0) cleaned.push({ text: '\n', marks: [] });
        if (chunk !== '') cleaned.push({ text: chunk, marks: span.marks });
      });
    });
    // Blank-line runs split blocks, mirroring blank-line markdown chunks;
    // lone breaks stay as soft newlines.
    const groups: RawSpan[][] = [[]];
    let heldBreak = false;
    for (const span of cleaned) {
      if (span.text === '\n' && span.marks.length === 0) {
        if (heldBreak) {
          groups.push([]);
          heldBreak = false;
        } else {
          heldBreak = true;
        }
      } else {
        if (heldBreak) {
          groups[groups.length - 1].push({ text: '\n', marks: [] });
          heldBreak = false;
        }
        groups[groups.length - 1].push(span);
      }
    }
    for (const group of groups) {
      while (group.length > 0 && group[0].text === '\n') group.shift();
      while (group.length > 0 && group[group.length - 1].text === '\n') group.pop();
      if (group.length > 0) {
        const first = group[0];
        const last = group[group.length - 1];
        first.text = first.text.replace(/^\s+/, '');
        last.text = last.text.replace(/\s+$/, '');
        const trimmed = group.filter((span) => span.text !== '');
        if (trimmed.some((span) => span.text.trim() !== '')) {
          blocks.push(normalizeManuscriptSpans(trimmed));
        }
      }
    }
    current = [];
    marks = [];
  };

  // A close (or the end of input) ends the pending paragraph: explicit
  // empties become blank-line blocks, content flushes normally, and
  // pretty-printing noise between blocks drops. Always consumes the flag so
  // nested closes (`<div><p></p></div>`) emit exactly one blank.
  const closeBoundary = () => {
    const explicitEmpty = pendingEmpty && !hasSignificantContent();
    flushBlock();
    pendingEmpty = false;
    if (explicitEmpty) blocks.push([]);
  };

  for (const token of tokens) {
    if (!token.startsWith('<') || !token.endsWith('>')) {
      if (skipDepth === 0 && token !== '') {
        const text = decodeEntities(token);
        current.push({ text, marks: [...marks] });
        if (/\S/.test(text)) pendingEmpty = false;
      }
      continue;
    }
    const inner = token.slice(1, -1).trim();
    const closing = inner.startsWith('/');
    const name = (closing ? inner.slice(1) : inner).split(/[\s/]/, 1)[0].toLowerCase();
    if (SKIP_TAGS.has(name)) {
      skipDepth += closing ? -1 : 1;
      if (skipDepth < 0) skipDepth = 0;
      continue;
    }
    if (skipDepth > 0) continue;
    if (closing) {
      if (BLOCK_TAGS.has(name)) {
        closeBoundary();
      } else if (TAG_TO_MARK[name] !== undefined) {
        const mark = TAG_TO_MARK[name];
        const at = marks.lastIndexOf(mark);
        if (at >= 0) marks.splice(at, 1);
      }
      continue;
    }
    if (BLOCK_TAGS.has(name)) {
      flushBlock();
      pendingEmpty = true;
    } else if (name === 'br' || name === 'wbr') {
      if (hasSignificantContent()) {
        current.push({ text: NEWLINE_STANDIN, marks: [] });
        pendingEmpty = false;
      } else {
        // Bare break between blocks: the host's empty-paragraph encoding.
        current = [];
        pendingEmpty = false;
        blocks.push([]);
      }
    } else if (name === 'hr') {
      flushBlock();
    } else if (name === 'img' || name === 'source') {
      continue;
    } else if (TAG_TO_MARK[name] !== undefined) {
      marks = [...marks, TAG_TO_MARK[name]];
    }
    // Any other tag: dropped, inner text kept.
  }
  closeBoundary();
  return normalizeManuscriptDocument({
    blocks: blocks.map((spans) => ({ kind: 'paragraph', spans })),
  });
}

/**
 * Serializes a document to the editor's canonical HTML (`<p>`/marks, with
 * `<p></p>` for blank lines). Soft lines promote to paragraphs: the host
 * rewrites an interior `<br>` into splits plus phantom empties when seeding,
 * so the boundary form never carries `<br>`.
 */
export function documentToEnrichedHtml(doc: ManuscriptDocument): string {
  const normalized = normalizeManuscriptDocument(doc);
  if (normalized.blocks.length === 0) return '';
  const wrapMark = (text: string, marks: ManuscriptMark[]): string => {
    for (const mark of [...HTML_OUTER_FIRST].reverse()) {
      if (marks.includes(mark)) {
        const tag = MARK_TO_TAG[mark];
        text = `<${tag}>${text}</${tag}>`;
      }
    }
    return text;
  };
  const blocksHtml: string[] = [];
  for (const block of normalized.blocks) {
    const lines: ManuscriptSpan[][] = [[]];
    for (const span of block.spans) {
      span.text.split('\n').forEach((segment, index) => {
        if (index > 0) lines.push([]);
        if (segment !== '') lines[lines.length - 1].push({ text: segment, marks: span.marks });
      });
    }
    for (const line of lines) {
      const inner = line.map((span) => wrapMark(escapeHtml(span.text), span.marks)).join('');
      blocksHtml.push(`<p>${inner}</p>`);
    }
  }
  return `<html>${blocksHtml.join('')}</html>`;
}
