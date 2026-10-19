import {
  normalizeManuscriptDocument,
  normalizeManuscriptSpans,
  type ManuscriptBlock,
  type ManuscriptDocument,
  type ManuscriptMark,
  type ManuscriptSpan,
} from './ManuscriptDocument';

/**
 * Storage boundary between the manuscript document model and the
 * `react-native-enriched-html` editor, whose source of truth is HTML.
 *
 * Canonical tags mirror the editor's supported set: `<p>` paragraphs
 * (an empty `<p></p>` is a blank line), `<ul>`/`<ol>` lists of `<li>` items,
 * `<b>`/`<i>`/`<u>`/`<s>` inline marks. A bare `<br>` between blocks is the
 * host's empty-paragraph encoding (it emits `<p></p>` as `<br>`); a `<br>`
 * after text stays a soft break, and inside a list item it reads as a space
 * (items are single-line). Nothing else the editor can produce (headings,
 * links, … — reachable via paste) survives as structure: prose text is never
 * lost, structure outside the model degrades to plain paragraphs. Unknown
 * tags, comments, scripts and styles are dropped the same way.
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
  const blocks: {
    kind: 'paragraph' | 'bullet' | 'ordered';
    index: number;
    spans: ManuscriptSpan[];
  }[] = [];
  let current: RawSpan[] = [];
  let marks: ManuscriptMark[] = [];
  let skipDepth = 0;
  // List context: `<ul>`/`<ol>` push a frame, `<li>` opens one single-line
  // item inside it. Nested lists flatten (inner items read as siblings).
  const listStack: { ordered: boolean; index: number }[] = [];
  let item: { ordered: boolean; index: number; parts: RawSpan[] } | null = null;

  const pushBlock = (
    spans: ManuscriptSpan[],
    kind: 'paragraph' | 'bullet' | 'ordered',
    index: number,
  ) => {
    blocks.push({ kind, index, spans });
  };

  /** Emits the open item as one bullet/ordered block, collapsing whitespace to spaces. */
  const flushItem = () => {
    if (!item) return;
    const words: RawSpan[] = [];
    for (const part of item.parts) {
      for (const chunk of part.text.split(/\s+/)) {
        if (chunk !== '') words.push({ text: chunk, marks: part.marks });
      }
    }
    const joined: RawSpan[] = [];
    words.forEach((word, wordIndex) => {
      if (wordIndex > 0) joined.push({ text: ' ', marks: [] });
      joined.push(word);
    });
    const spans = normalizeManuscriptSpans(joined);
    if (item.ordered) pushBlock(spans, 'ordered', item.index);
    else pushBlock(spans, 'bullet', 0);
    item = null;
  };
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
          pushBlock(normalizeManuscriptSpans(trimmed), 'paragraph', 0);
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
    if (explicitEmpty) pushBlock([], 'paragraph', 0);
  };

  for (const token of tokens) {
    if (!token.startsWith('<') || !token.endsWith('>')) {
      if (skipDepth === 0 && token !== '') {
        const text = decodeEntities(token);
        if (item) item.parts.push({ text, marks: [...marks] });
        else current.push({ text, marks: [...marks] });
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
    if (name === 'ul' || name === 'ol') {
      if (closing) {
        flushItem();
        flushBlock();
        listStack.pop();
      } else {
        flushBlock();
        listStack.push({ ordered: name === 'ol', index: 0 });
      }
      continue;
    }
    if (name === 'li') {
      const frame = listStack[listStack.length - 1];
      // A stray `<li>` outside any list degrades to a plain paragraph boundary.
      if (!frame) {
        if (closing) closeBoundary();
        else {
          flushBlock();
          pendingEmpty = true;
        }
        continue;
      }
      if (closing) {
        flushItem();
      } else {
        flushItem();
        flushBlock();
        if (frame.ordered) frame.index += 1;
        item = { ordered: frame.ordered, index: frame.index, parts: [] };
      }
      continue;
    }
    if (closing) {
      if (BLOCK_TAGS.has(name)) {
        if (item) item.parts.push({ text: ' ', marks: [] });
        else closeBoundary();
      } else if (TAG_TO_MARK[name] !== undefined) {
        const mark = TAG_TO_MARK[name];
        const at = marks.lastIndexOf(mark);
        if (at >= 0) marks.splice(at, 1);
      }
      continue;
    }
    if (BLOCK_TAGS.has(name)) {
      if (item) {
        // Block structure inside an item flattens to spacing: items stay single-line.
        if (item.parts.length > 0) item.parts.push({ text: ' ', marks: [] });
      } else {
        flushBlock();
        pendingEmpty = true;
      }
    } else if (name === 'br' || name === 'wbr') {
      if (item) {
        item.parts.push({ text: ' ', marks: [] });
      } else if (hasSignificantContent()) {
        current.push({ text: NEWLINE_STANDIN, marks: [] });
        pendingEmpty = false;
      } else {
        // Bare break between blocks: the host's empty-paragraph encoding.
        current = [];
        pendingEmpty = false;
        pushBlock([], 'paragraph', 0);
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
  flushItem();
  closeBoundary();
  return normalizeManuscriptDocument({
    blocks: blocks.map((block) =>
      block.kind === 'ordered'
        ? { kind: 'ordered' as const, index: block.index, spans: block.spans }
        : { kind: block.kind, spans: block.spans },
    ),
  });
}

/**
 * Serializes a document to the editor's canonical HTML (`<p>`/marks, with
 * `<p></p>` for blank lines, consecutive items grouped in `<ul>`/`<ol>`).
 * Soft lines promote to paragraphs: the host rewrites an interior `<br>`
 * into splits plus phantom empties when seeding, so the boundary form never
 * carries `<br>` — except inside items, where a stray break degrades to a
 * space on the way back in.
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
  const itemInner = (block: ManuscriptBlock): string => {
    const lines: ManuscriptSpan[][] = [[]];
    for (const span of block.spans) {
      span.text.split('\n').forEach((segment, index) => {
        if (index > 0) lines.push([]);
        if (segment !== '') lines[lines.length - 1].push({ text: segment, marks: span.marks });
      });
    }
    return lines
      .map((line) => line.map((span) => wrapMark(escapeHtml(span.text), span.marks)).join(''))
      .join('<br>');
  };
  const blocksHtml: string[] = [];
  let at = 0;
  while (at < normalized.blocks.length) {
    const block = normalized.blocks[at];
    if (block.kind === 'bullet' || block.kind === 'ordered') {
      const tag = block.kind === 'bullet' ? 'ul' : 'ol';
      const items: string[] = [];
      while (at < normalized.blocks.length && normalized.blocks[at].kind === block.kind) {
        items.push(`<li>${itemInner(normalized.blocks[at])}</li>`);
        at += 1;
      }
      blocksHtml.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
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
    at += 1;
  }
  return `<html>${blocksHtml.join('')}</html>`;
}
