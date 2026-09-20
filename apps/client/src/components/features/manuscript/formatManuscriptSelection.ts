export type ManuscriptFormatKind = 'bold' | 'italic' | 'underline' | 'heading';

export type TextSelection = { start: number; end: number };

export type FormattedText = { text: string; selection: TextSelection };

const INLINE_MARKERS: Record<'bold' | 'italic' | 'underline', string> = {
  bold: '**',
  italic: '*',
  underline: '__',
};

function wrapInline(
  text: string,
  selection: TextSelection,
  marker: string,
): FormattedText {
  const start = Math.min(selection.start, selection.end);
  const end = Math.max(selection.start, selection.end);
  const wrapped = `${text.slice(0, start)}${marker}${text.slice(start, end)}${marker}${text.slice(end)}`;
  const caret = start + marker.length;
  return {
    text: wrapped,
    selection:
      start === end
        ? { start: caret, end: caret }
        : { start: caret, end: caret + (end - start) },
  };
}

const HEADING_PREFIXES = ['', '# ', '## ', '### '];

/**
 * Cycles the cursor's line through plain → H1 → H2 → H3 → plain. Only the line
 * holding the caret is touched; multiline selections format around the caret.
 */
function cycleHeading(text: string, selection: TextSelection): FormattedText {
  const caret = Math.min(selection.start, selection.end);
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1;
  const rest = text.slice(lineStart);
  // `## ` starts with `# `: match the longest prefix first.
  const level =
    rest.startsWith('### ') ? 3 : rest.startsWith('## ') ? 2 : rest.startsWith('# ') ? 1 : 0;
  const next = HEADING_PREFIXES[(level + 1) % HEADING_PREFIXES.length];
  const stripped = rest.slice(HEADING_PREFIXES[level].length);
  const nextText = text.slice(0, lineStart) + next + stripped;
  const delta = next.length - HEADING_PREFIXES[level].length;
  return {
    text: nextText,
    selection: { start: selection.start + delta, end: selection.end + delta },
  };
}

/**
 * Applies a toolbar action to the manuscript text. Inline styles wrap the selection
 * (or drop an empty pair around the caret); headings cycle the caret's line. Pure
 * so the toolbar stays a dumb button row and every edge is unit-tested.
 */
export function applyManuscriptFormat(
  text: string,
  selection: TextSelection,
  kind: ManuscriptFormatKind,
): FormattedText {
  if (kind === 'heading') return cycleHeading(text, selection);
  return wrapInline(text, selection, INLINE_MARKERS[kind]);
}
