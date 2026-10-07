/*
 * ChordPro (https://www.chordpro.org) is plain text that reads like a lead sheet: a line of lyrics
 * with the chords in square brackets right before the syllable they fall on, and curly-brace
 * directives for the rest. Only the part a story needs is read here:
 *
 *   {title: Tavern song}   {key: G}   {tempo: 90}   {time: 3/4}          the song's facts
 *   {start_of_verse: Verse 1} ... {end_of_verse}                            a section (also chorus, bridge)
 *   {chorus} or {chorus: Chorus}                                            "the chorus again, here"
 *   {comment: text}  {comment_italic: text}                                 a line for the reader
 *   [G]Night de[Em]scends                                                   a line of lyrics with chords
 *   # a line the writer keeps for themselves                                never read
 *
 * The text is the source and is never rewritten by reading it: this file only *understands* it. A
 * directive it does not know is ignored, and stays in the text.
 *
 * In the lyrics, `·` (a middle dot) marks where a syllable ends: it counts for the syllable
 * counter and is not printed.
 */

export const SYLLABLE_MARK = '·';

export type SongSectionKind = 'verse' | 'chorus' | 'bridge' | 'none';

/** A stretch of a line and the chord that falls on its first syllable (`null` for plain text). */
export interface SongSegment {
  chord: string | null;
  text: string;
}

export type SongLine =
  | { kind: 'lyric'; segments: SongSegment[] }
  | { kind: 'comment'; text: string; italic: boolean }
  /** "The chorus again, here": prints as its label, not as the text of the chorus. */
  | { kind: 'recall'; label: string | null }
  | { kind: 'blank' };

export interface SongSection {
  /** The label the section goes by (`Chorus`, `Verse 2`); `null` for text outside any section. */
  label: string | null;
  kind: SongSectionKind;
  lines: SongLine[];
}

/** The song's own facts, as the text states them. They are empty when it states none. */
export interface SongDirectiveMeta {
  title: string | null;
  subtitle: string | null;
  key: string | null;
  tempo: number | null;
  /** `3/4`, as written. */
  time: string | null;
  capo: number | null;
}

export interface ParsedSong {
  meta: SongDirectiveMeta;
  sections: SongSection[];
}

/** What an unlabelled `{start_of_verse}` is called: the words of the person's language. */
export interface SectionWords {
  verse: string;
  chorus: string;
  bridge: string;
}

export const DEFAULT_SECTION_WORDS: SectionWords = {
  verse: 'Verse',
  chorus: 'Chorus',
  bridge: 'Bridge',
};

const START_KIND: Record<string, Exclude<SongSectionKind, 'none'>> = {
  start_of_verse: 'verse',
  sov: 'verse',
  start_of_chorus: 'chorus',
  soc: 'chorus',
  start_of_bridge: 'bridge',
  sob: 'bridge',
};

const END_NAMES = new Set([
  'end_of_verse',
  'eov',
  'end_of_chorus',
  'eoc',
  'end_of_bridge',
  'eob',
]);

const DIRECTIVE = /^\{\s*([a-z_]+)\s*(?:[:\s]\s*([^}]*?))?\s*\}$/i;
const CHORD_TOKEN = /\[([^\]]*)\]/g;

/** One directive, or `null` for a line that is not one. The value is trimmed; `''` when it has none. */
export function readDirective(line: string): { name: string; value: string } | null {
  const match = DIRECTIVE.exec(line.trim());
  if (!match) return null;
  return { name: match[1].toLowerCase(), value: (match[2] ?? '').trim() };
}

/** A lyric line cut into its chords: `[G]Night de[Em]scends` is two segments. */
export function parseLyricLine(line: string): SongSegment[] {
  const segments: SongSegment[] = [];
  let chord: string | null = null;
  let last = 0;
  for (const match of line.matchAll(CHORD_TOKEN)) {
    const before = line.slice(last, match.index);
    if (before !== '' || chord !== null) segments.push({ chord, text: before });
    chord = match[1].trim() === '' ? null : match[1].trim();
    last = match.index + match[0].length;
  }
  const rest = line.slice(last);
  if (rest !== '' || chord !== null || segments.length === 0) segments.push({ chord, text: rest });
  return segments;
}

/** The words of a line with no chords: what is sung, as plain text. */
export function lyricText(segments: readonly SongSegment[], keepSyllableMarks = false): string {
  const text = segments.map((segment) => segment.text).join('');
  return keepSyllableMarks ? text : text.split(SYLLABLE_MARK).join('');
}

/** What a section is called when its directive says nothing: `Verse 2` when there are several. */
function autoLabel(
  kind: Exclude<SongSectionKind, 'none'>,
  ordinal: number,
  total: number,
  words: SectionWords,
): string {
  return total > 1 ? `${words[kind]} ${ordinal}` : words[kind];
}

/**
 * Reads the song. Sections come out in the order they are written, each with the label it goes by:
 * the directive's own, or the kind's word numbered when several share it. Text outside any section
 * is gathered into sections of its own with no label, so nothing written is lost.
 */
export function parseChordPro(
  text: string,
  words: SectionWords = DEFAULT_SECTION_WORDS,
): ParsedSong {
  const meta: SongDirectiveMeta = {
    title: null,
    subtitle: null,
    key: null,
    tempo: null,
    time: null,
    capo: null,
  };

  type Pending = {
    kind: Exclude<SongSectionKind, 'none'>;
    label: string | null;
    lines: SongLine[];
  };
  const raw: Array<{ section: SongSection | null; pending: Pending | null }> = [];
  let outside: SongLine[] = [];
  let open: Pending | null = null;

  const closeOutside = () => {
    if (outside.some((line) => line.kind !== 'blank')) {
      raw.push({ section: { label: null, kind: 'none', lines: trimBlank(outside) }, pending: null });
    }
    outside = [];
  };
  const target = (): SongLine[] => (open ? open.lines : outside);

  for (const source of text.replace(/\r\n?/g, '\n').split('\n')) {
    const trimmed = source.trim();
    if (trimmed.startsWith('#')) continue;
    if (trimmed === '') {
      target().push({ kind: 'blank' });
      continue;
    }
    const directive = readDirective(trimmed);
    if (directive) {
      const { name, value } = directive;
      if (START_KIND[name]) {
        if (open) raw.push({ section: null, pending: open });
        else closeOutside();
        open = { kind: START_KIND[name], label: value || null, lines: [] };
      } else if (END_NAMES.has(name)) {
        if (open) {
          raw.push({ section: null, pending: open });
          open = null;
        }
      } else if (name === 'chorus') {
        target().push({ kind: 'recall', label: value || null });
      } else if (name === 'comment' || name === 'c') {
        target().push({ kind: 'comment', text: value, italic: false });
      } else if (name === 'comment_italic' || name === 'ci') {
        target().push({ kind: 'comment', text: value, italic: true });
      } else if (name === 'title' || name === 't') meta.title = value || null;
      else if (name === 'subtitle' || name === 'st') meta.subtitle = value || null;
      else if (name === 'key') meta.key = value || null;
      else if (name === 'tempo') {
        const tempo = Number.parseFloat(value);
        meta.tempo = Number.isFinite(tempo) && tempo > 0 ? tempo : null;
      } else if (name === 'time') meta.time = value || null;
      else if (name === 'capo') {
        const capo = Number.parseInt(value, 10);
        meta.capo = Number.isFinite(capo) && capo >= 0 ? capo : null;
      }
      // Anything else is a directive this reader does not know: it stays in the text, unread.
      continue;
    }
    target().push({ kind: 'lyric', segments: parseLyricLine(source) });
  }
  if (open) raw.push({ section: null, pending: open });
  closeOutside();

  const total = { verse: 0, chorus: 0, bridge: 0 };
  for (const entry of raw) {
    if (entry.pending && !entry.pending.label) total[entry.pending.kind] += 1;
  }
  const seen = { verse: 0, chorus: 0, bridge: 0 };
  const sections: SongSection[] = raw.map((entry) => {
    if (entry.section) return entry.section;
    const pending = entry.pending as Pending;
    let label = pending.label;
    if (!label) {
      seen[pending.kind] += 1;
      label = autoLabel(pending.kind, seen[pending.kind], total[pending.kind], words);
    }
    return { label, kind: pending.kind, lines: trimBlank(pending.lines) };
  });
  return { meta, sections };
}

function trimBlank(lines: SongLine[]): SongLine[] {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].kind === 'blank') start += 1;
  while (end > start && lines[end - 1].kind === 'blank') end -= 1;
  return lines.slice(start, end);
}

/** The lyric lines of a section, in order (comments and recalls left out). */
export function lyricLinesOf(section: SongSection): SongSegment[][] {
  return section.lines.flatMap((line) => (line.kind === 'lyric' ? [line.segments] : []));
}

/** The chords written in the lyrics, in order, as written. */
export function chordsOf(text: string): string[] {
  const chords: string[] = [];
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim().startsWith('#') || readDirective(line)) continue;
    for (const match of line.matchAll(CHORD_TOKEN)) {
      const chord = match[1].trim();
      if (chord) chords.push(chord);
    }
  }
  return chords;
}
