import {
  DEFAULT_SECTION_WORDS,
  type ParsedSong,
  parseChordPro,
  readDirective,
  type SectionWords,
  type SongLine,
  type SongSection,
} from './chordpro';

/** The labels the lyrics give their sections, in the order written (text outside any section has none). */
export function sectionLabels(text: string, words: SectionWords = DEFAULT_SECTION_WORDS): string[] {
  return parseChordPro(text, words).sections.flatMap((section) =>
    section.label ? [section.label] : [],
  );
}

/** Labels written more than once: a scene that names one cannot say which it means. */
export function duplicateSectionLabels(
  text: string,
  words: SectionWords = DEFAULT_SECTION_WORDS,
): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const label of sectionLabels(text, words)) {
    if (seen.has(label)) repeated.add(label);
    seen.add(label);
  }
  return [...repeated];
}

const START_NAMES = new Set([
  'start_of_verse',
  'sov',
  'start_of_chorus',
  'soc',
  'start_of_bridge',
  'sob',
]);

/**
 * The lyrics with every section that shares a label numbered (`Verse` and `Verse` become `Verse 1`
 * and `Verse 2`), so each is told apart. A section with a label of its own, written once, is left
 * as it is, and so is everything else: only the directives of the repeated labels are rewritten.
 */
export function numberDuplicateSections(
  text: string,
  words: SectionWords = DEFAULT_SECTION_WORDS,
): string {
  const repeated = new Set(duplicateSectionLabels(text, words));
  if (repeated.size === 0) return text;
  const counts = new Map<string, number>();
  const parsedLabels = parseChordPro(text, words).sections.flatMap((section) =>
    section.label ? [section.label] : [],
  );
  let next = 0;
  return text
    .split(/(\r?\n)/)
    .map((line) => {
      const directive = readDirective(line);
      if (!directive || !START_NAMES.has(directive.name)) return line;
      const label = parsedLabels[next];
      next += 1;
      if (!repeated.has(label)) return line;
      const ordinal = (counts.get(label) ?? 0) + 1;
      counts.set(label, ordinal);
      return `{${directive.name}: ${label} ${ordinal}}`;
    })
    .join('');
}

/** What a scene prints of a song: the lines, which of the asked sections were found, and which were not. */
export interface SongExcerpt {
  sections: SongSection[];
  found: string[];
  missing: string[];
  /** Nothing asked for was found (or nothing was asked): the whole song stands in. */
  wholeSong: boolean;
}

/**
 * The part of a song a scene sings. `wanted` is the labels the scene names (`null` is the whole
 * song). Whichever of them still exist are kept, in the order they stand in the song; when none
 * does, the whole song is printed instead - the writer is told by Story Analysis.
 */
export function songExcerpt(song: ParsedSong, wanted: readonly string[] | null): SongExcerpt {
  const labelled = song.sections.filter((section) => section.label);
  if (!wanted || wanted.length === 0) {
    return { sections: song.sections, found: [], missing: [], wholeSong: true };
  }
  const wantedSet = new Set(wanted);
  const kept = song.sections.filter((section) => section.label && wantedSet.has(section.label));
  const found = [...new Set(kept.map((section) => section.label as string))];
  const missing = wanted.filter((label) => !labelled.some((section) => section.label === label));
  if (kept.length === 0) {
    return { sections: song.sections, found: [], missing: [...missing], wholeSong: true };
  }
  return { sections: kept, found, missing: [...missing], wholeSong: false };
}

/** A line is only its text when it is lyrics; a recall prints as the label it recalls. */
export function plainLines(
  section: SongSection,
  recallText: (label: string | null) => string,
  keepSyllableMarks = false,
): string[] {
  const render = (line: SongLine): string | null => {
    if (line.kind === 'lyric') {
      const text = line.segments.map((segment) => segment.text).join('');
      return keepSyllableMarks ? text : text.split('·').join('');
    }
    if (line.kind === 'recall') return recallText(line.label);
    if (line.kind === 'comment') return line.text;
    return '';
  };
  return section.lines.flatMap((line) => {
    const text = render(line);
    return text === null ? [] : [text];
  });
}

/** What a section is called when it is added: its kind's word, numbered past the ones already there. */
export function nextSectionLabel(
  kind: 'verse' | 'chorus' | 'bridge',
  text: string,
  words: SectionWords = DEFAULT_SECTION_WORDS,
): string {
  const taken = new Set(sectionLabels(text, words));
  const word = words[kind];
  // A chorus or a bridge is usually one: it keeps its plain word until a second needs telling apart.
  if (kind !== 'verse' && !taken.has(word)) return word;
  let ordinal = 1;
  while (taken.has(`${word} ${ordinal}`)) ordinal += 1;
  return `${word} ${ordinal}`;
}

/** The text of an empty section of a kind, with its label written out so it never depends on a language. */
export function sectionBlock(kind: 'verse' | 'chorus' | 'bridge', label: string): string {
  return `{start_of_${kind}: ${label}}\n\n{end_of_${kind}}\n`;
}

/**
 * The text with `insert` put in at `index`, on a line of its own: a blank line before it when what
 * comes before does not end one, and a line break after it.
 */
export function insertBlockAt(text: string, index: number, insert: string): string {
  const at = Math.min(Math.max(index, 0), text.length);
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead =
    before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const tail = after === '' || after.startsWith('\n') ? '' : '\n';
  return `${before}${lead}${insert}${tail}${after}`;
}
