export type ManuscriptInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type ManuscriptBlock =
  | { key: string; kind: 'heading'; level: 1 | 2 | 3; inlines: ManuscriptInline[] }
  | { key: string; kind: 'paragraph'; inlines: ManuscriptInline[] };

function parseInlines(text: string): ManuscriptInline[] {
  const out: ManuscriptInline[] = [];
  const pushItalics = (segment: string) => {
    const italicPattern = /\*([^*\n]+?)\*/g;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = italicPattern.exec(segment)) !== null) {
      if (match.index > cursor) out.push({ text: segment.slice(cursor, match.index) });
      out.push({ text: match[1], italic: true });
      cursor = match.index + match[0].length;
    }
    if (cursor < segment.length) out.push({ text: segment.slice(cursor) });
  };
  const boldPattern = /\*\*(.+?)\*\*/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > cursor) pushItalics(text.slice(cursor, match.index));
    out.push({ text: match[1], bold: true });
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) pushItalics(text.slice(cursor));
  return out.filter((span) => span.text.length > 0);
}

/**
 * Minimal manuscript markdown: `#`/`##`/`###` headings, `**bold**`, `*italic*`,
 * blank-line separated blocks. Single newlines inside a block are preserved (dialogue
 * lines), unmatched markers stay literal. Deliberately dependency-free: prose needs
 * nothing more, and a new renderer dependency is a Hermes-compat risk for zero gain.
 */
export function parseManuscriptMarkdown(markdown: string): ManuscriptBlock[] {
  const chunks = markdown.split(/\n\s*\n/).map((chunk) => chunk.trim()).filter(Boolean);
  return chunks.map((chunk, index) => {
    const key = `block-${index}`;
    const heading = /^(#{1,3})\s+(.+)$/.exec(chunk);
    if (heading) {
      return {
        key,
        kind: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        inlines: parseInlines(heading[2]),
      };
    }
    return { key, kind: 'paragraph', inlines: parseInlines(chunk) };
  });
}
