import {
  type ParsedSong,
  parseChordPro,
  type SongLine,
  type SongSection,
  SYLLABLE_MARK,
} from '../../music/chordpro';
import { songExcerpt } from '../../music/sections';
import type { CompiledBlock, CompiledSpan } from './export/manuscriptCompiler';
import type { ManuscriptSceneMusic, ManuscriptSong } from './manuscriptSections';

/** Where the songs a scene sings are printed. */
export const SONG_PLACEMENTS = ['appendix', 'after-scene'] as const;
export type SongPlacement = (typeof SONG_PLACEMENTS)[number];

/** Which words are printed: the sung ones, their translation, or both. */
export const SONG_LANGUAGES = ['sung', 'translation', 'both'] as const;
export type SongLanguage = (typeof SONG_LANGUAGES)[number];

/** Whether a part of a song that a scene already printed is printed again by the next that sings it. */
export const SONG_REPEATS = ['first-only', 'every'] as const;
export type SongRepeat = (typeof SONG_REPEATS)[number];

/** How a manuscript prints songs. Absent from an export, it prints none. */
export interface SongPrint {
  placement: SongPlacement;
  language: SongLanguage;
  repeat: SongRepeat;
  /** The chords stay in the lines, in brackets, as in a song book. */
  chords: boolean;
  /** The heading of the appendix of songs. */
  heading: string;
  /** What `{chorus}` ("again, here") prints: its label as a note. */
  recall: (label: string | null) => string;
}

export const DEFAULT_SONG_PRINT: SongPrint = {
  placement: 'appendix',
  language: 'sung',
  repeat: 'first-only',
  chords: false,
  heading: 'Songs',
  recall: (label) => `(${label ?? '↻'})`,
};

/** The bookmark of the appendix of songs; the loose scenes keep `appendix`. */
export const SONGS_BOOKMARK_ID = 'songs';

const span = (text: string, marks: Partial<CompiledSpan> = {}): CompiledSpan => ({
  text,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  ...marks,
});

const withoutMarks = (text: string) => text.split(SYLLABLE_MARK).join('');

/** One line as it is printed: the words, with the chords in brackets when they are kept. */
function lineText(line: Extract<SongLine, { kind: 'lyric' }>, chords: boolean): string {
  return line.segments
    .map(
      (segment) =>
        `${chords && segment.chord ? `[${segment.chord}]` : ''}${withoutMarks(segment.text)}`,
    )
    .join('');
}

type Piece = { kind: 'stanza' | 'note'; text: string };

/** A section's lines as printed: a stanza is one paragraph of lines, a comment or a recall a note. */
function piecesOf(section: SongSection, print: SongPrint, chords: boolean): Piece[] {
  const pieces: Piece[] = [];
  let stanza: string[] = [];
  const closeStanza = () => {
    if (stanza.length > 0) pieces.push({ kind: 'stanza', text: stanza.join('\n') });
    stanza = [];
  };
  for (const line of section.lines) {
    if (line.kind === 'lyric') {
      stanza.push(lineText(line, chords));
    } else if (line.kind === 'blank') {
      closeStanza();
    } else if (line.kind === 'comment') {
      closeStanza();
      if (line.text.trim()) pieces.push({ kind: 'note', text: line.text.trim() });
    } else {
      closeStanza();
      pieces.push({ kind: 'note', text: print.recall(line.label) });
    }
  }
  closeStanza();
  return pieces;
}

const printedKey = (songId: string, label: string | null) => `${songId}\u0000${label ?? ''}`;

/** What has been printed so far in a manuscript: the parts of songs, so a repeat can be told. */
export type PrintedSongs = Set<string>;

export interface SongBlocksOptions {
  print: SongPrint;
  /** Print the label of each section above it (the appendix does, a scene's lyrics do not). */
  showLabels: boolean;
  /** Skip the parts already printed (the `first-only` rule); the appendix prints it all. */
  skipPrinted: boolean;
}

/**
 * The blocks of the part of a song a scene sings. `printed` is read and written: whatever this call
 * prints is marked, so the next scene that sings it can leave it out.
 */
export function songBlocks(
  song: ManuscriptSong,
  wanted: readonly string[] | null,
  printed: PrintedSongs,
  options: SongBlocksOptions,
): CompiledBlock[] {
  const { print, showLabels, skipPrinted } = options;
  const sung = parseChordPro(song.lyrics);
  const translation = song.lyricsTranslation ? parseChordPro(song.lyricsTranslation) : null;
  const excerpt = songExcerpt(sung, wanted);
  const blocks: CompiledBlock[] = [];

  const translationOf = (label: string | null): SongSection | null => {
    if (!translation) return null;
    if (label) return translation.sections.find((section) => section.label === label) ?? null;
    return null;
  };
  const paragraph = (text: string, marks: Partial<CompiledSpan>): CompiledBlock => ({
    kind: 'paragraph',
    spans: [span(text, marks)],
  });

  for (const section of excerpt.sections) {
    if (skipPrinted && printed.has(printedKey(song.id, section.label))) continue;
    const other = translationOf(section.label);
    // A translation that has no such section cannot stand in for it: the sung words are printed.
    const sungPieces = piecesOf(section, print, print.chords);
    const otherPieces = other ? piecesOf(other, print, false) : [];
    const pieces =
      print.language === 'translation' && other
        ? [{ items: otherPieces, translated: true }]
        : print.language === 'both' && other
          ? [
              { items: sungPieces, translated: false },
              { items: otherPieces, translated: true },
            ]
          : [{ items: sungPieces, translated: false }];
    if (pieces.every((group) => group.items.length === 0)) continue;

    if (showLabels && section.label) blocks.push(paragraph(section.label, { bold: true }));
    for (const group of pieces) {
      for (const piece of group.items) {
        // What is sung is in italics, as a book sets verse; its translation is set plainly beneath it.
        blocks.push(paragraph(piece.text, { italic: !group.translated || piece.kind === 'note' }));
      }
    }
    printed.add(printedKey(song.id, section.label));
  }
  return blocks;
}

/** The song's title as a line of its own: bold at the head of an appendix entry. */
export function songTitleBlock(title: string): CompiledBlock {
  return { kind: 'paragraph', spans: [span(title, { bold: true })] };
}

/** `♪ Title`: what a scene prints when the song it sings was printed in full before. */
export function songMentionBlock(title: string): CompiledBlock {
  return { kind: 'paragraph', spans: [span(`♪ ${title}`, { italic: true })] };
}

/** The in-world songs of a scene that carry their words, in order. */
export function sungSongsOf(music: readonly ManuscriptSceneMusic[] | undefined): ManuscriptSong[] {
  return (music ?? []).flatMap((item) =>
    item.role === 'in-world' && item.song ? [item.song] : [],
  );
}

/**
 * How many songs a manuscript prints whole although a scene asked for parts of it: every part the
 * scene names is gone from the words, so the whole song stands in (see `songExcerpt`). Counted by
 * song, not by scene. The words of a song are parsed only when a scene names parts of it.
 */
export function countSongsPrintedWhole(
  music: Iterable<readonly ManuscriptSceneMusic[] | undefined>,
): number {
  const whole = new Set<string>();
  for (const scene of music) {
    for (const song of sungSongsOf(scene)) {
      if (whole.has(song.id) || !song.sections || song.sections.length === 0) continue;
      const excerpt = songExcerpt(parseChordPro(song.lyrics), song.sections);
      if (excerpt.wholeSong && excerpt.missing.length > 0) whole.add(song.id);
    }
  }
  return whole.size;
}

export type { ParsedSong };
