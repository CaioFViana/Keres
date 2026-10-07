import { parseChordPro, readDirective } from './chordpro';

/** A song as a `.cho` file carries it: its facts and its lyrics. */
export interface ChordProFile {
  title: string;
  key: string | null;
  tempo: number | null;
  meter: string | null;
  lyrics: string;
}

/** Directives the song keeps in its own columns: they leave the lyrics when a file is read. */
const FACT_DIRECTIVES = new Set(['title', 't', 'subtitle', 'st', 'key', 'tempo', 'time', 'capo']);

/** A song written as a ChordPro file: its facts as directives, then its lyrics as they are. */
export function chordProFileOf(song: ChordProFile): string {
  const head = [`{title: ${song.title.replace(/[\r\n]+/g, ' ').trim()}}`];
  if (song.key) head.push(`{key: ${song.key}}`);
  if (song.meter) head.push(`{time: ${song.meter}}`);
  if (song.tempo) head.push(`{tempo: ${song.tempo}}`);
  return `${head.join('\n')}\n\n${song.lyrics.trim()}\n`;
}

/**
 * Reads a ChordPro file into a song: the facts go to their fields, and the lyrics keep everything
 * else, sections, comments and chords included, exactly as written.
 */
export function readChordProFile(text: string, fallbackTitle = ''): ChordProFile {
  const { meta } = parseChordPro(text);
  const kept = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => {
      const directive = readDirective(line);
      return !(directive && FACT_DIRECTIVES.has(directive.name));
    });
  return {
    title: meta.title?.trim() || fallbackTitle,
    key: meta.key,
    tempo: meta.tempo,
    meter: meta.time,
    lyrics: kept.join('\n').replace(/^\n+/, '').replace(/\s+$/, ''),
  };
}
