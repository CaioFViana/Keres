export interface TextSegment {
  text: string;
  match: boolean;
}

/**
 * Cuts `text` into the pieces that match the searched `term` (ignoring case) and the pieces
 * between them. An empty or blank term, or text without it, comes back as a single plain piece.
 */
export function splitByTerm(text: string, term: string | undefined | null): TextSegment[] {
  const needle = (term ?? '').trim().toLocaleLowerCase();
  if (!needle || !text) return [{ text, match: false }];

  const haystack = text.toLocaleLowerCase();
  // Lowercasing can change a string's length (a few scripts); then the offsets no longer line up.
  if (haystack.length !== text.length) return [{ text, match: false }];

  const segments: TextSegment[] = [];
  let cursor = 0;
  let found = haystack.indexOf(needle, cursor);
  while (found !== -1) {
    if (found > cursor) segments.push({ text: text.slice(cursor, found), match: false });
    segments.push({ text: text.slice(found, found + needle.length), match: true });
    cursor = found + needle.length;
    found = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments.length > 0 ? segments : [{ text, match: false }];
}
