import { lyricText, parseChordPro, type SongSection } from './chordpro';
import { parseMelody } from './melody';
import { songExcerpt } from './sections';
import { DEFAULT_TEMPO, quarterBeatsPerBar } from './songStats';
import type { SyllableLanguage } from './syllables';
import { buildTimeline } from './timeline';

/**
 * The music of a story as a working sheet for whoever will compose or license it: for each scene, what
 * comes in and when, who hears it, what it is, where a reference can be found, in what key and at what
 * speed, how long it runs and what is sung. A private document - it carries the Gallery references
 * that a manuscript never does.
 */
export interface CueSheetRow {
  scene: string;
  chapter: string | null;
  /** When it comes in and goes out. */
  cue: string | null;
  role: 'in-world' | 'score';
  /** The song's title or the medium's name; `null` when what it pointed at is gone. */
  music: string | null;
  kind: 'song' | 'medium';
  /** A medium's link or file name. */
  reference: string | null;
  key: string | null;
  tempo: number | null;
  meter: string | null;
  seconds: number | null;
  /** The sections of the song the scene sings; `null` is all of it. */
  sections: string[] | null;
  /** The words sung, without chords. */
  lyrics: string | null;
}

export interface CueSheetLabels {
  title: string;
  scene: string;
  chapter: string;
  cue: string;
  role: string;
  music: string;
  reference: string;
  key: string;
  tempo: string;
  meter: string;
  duration: string;
  sections: string;
  lyrics: string;
  inWorld: string;
  score: string;
  /** What stands where the music a cue pointed at is gone. */
  gone: string;
}

/** `1:05`: a length in seconds the way a person reads it. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '';
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export interface SongForLength {
  lyrics: string;
  melody: string | null;
  tempo: number | null;
  meter: string | null;
}

function estimateSections(
  sections: readonly SongSection[],
  tempo: number | null,
  meter: string | null,
) {
  const chords = sections.reduce(
    (sum, section) =>
      sum +
      section.lines.reduce(
        (inner, line) =>
          inner +
          (line.kind === 'lyric' ? line.segments.filter((s) => s.chord !== null).length : 0),
        0,
      ),
    0,
  );
  const lines = sections.reduce(
    (sum, section) => sum + section.lines.filter((line) => line.kind === 'lyric').length,
    0,
  );
  const bars = chords > 0 ? chords : lines * 2;
  return (bars * quarterBeatsPerBar(meter) * 60) / (tempo && tempo > 0 ? tempo : DEFAULT_TEMPO);
}

/**
 * How long a scene's part of a song runs. From the tune when it has one, section by section; and
 * from the chords (a bar each) or the lines (two bars each) when it has none. `exact` says which.
 */
export function songSeconds(
  song: SongForLength,
  sections: readonly string[] | null,
  language: SyllableLanguage,
): { seconds: number; exact: boolean } {
  const parsed = parseChordPro(song.lyrics);
  const excerpt = songExcerpt(parsed, sections);
  const tune = song.melody ? parseMelody(song.melody) : null;
  let seconds = 0;
  let exact = true;
  for (const section of excerpt.sections) {
    // A section is timed by its notes when it has some; the others are guessed from their chords.
    const timeline = tune
      ? buildTimeline(parsed, tune, {
          language,
          tempo: song.tempo,
          meter: song.meter,
          onlySection: parsed.sections.indexOf(section),
        })
      : null;
    if (timeline && timeline.notes.length > 0) {
      seconds += timeline.seconds;
    } else {
      seconds += estimateSections([section], song.tempo, song.meter);
      exact = false;
    }
  }
  return { seconds: Math.round(seconds), exact: exact && excerpt.sections.length > 0 };
}

/** The words a scene sings, without the chords: its sections' lines, a blank line between sections. */
export function sungWords(lyrics: string, sections: readonly string[] | null): string {
  const excerpt = songExcerpt(parseChordPro(lyrics), sections);
  return excerpt.sections
    .map((section) =>
      section.lines
        .flatMap((line) => (line.kind === 'lyric' ? [lyricText(line.segments)] : []))
        .join('\n'),
    )
    .filter((block) => block.trim() !== '')
    .join('\n\n');
}

const roleLabel = (row: CueSheetRow, labels: CueSheetLabels) =>
  row.role === 'in-world' ? labels.inWorld : labels.score;

/** A cell that a spreadsheet will not take for a formula. */
function safe(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = safe(String(value));
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The sheet as CSV a spreadsheet opens (UTF-8 with its marker, lines ended the way Excel wants). */
export function cueSheetCsv(rows: readonly CueSheetRow[], labels: CueSheetLabels): string {
  const header = [
    labels.scene,
    labels.chapter,
    labels.cue,
    labels.role,
    labels.music,
    labels.reference,
    labels.key,
    labels.tempo,
    labels.meter,
    labels.duration,
    labels.sections,
    labels.lyrics,
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.scene,
        row.chapter,
        row.cue,
        roleLabel(row, labels),
        row.music ?? labels.gone,
        row.reference,
        row.key,
        row.tempo,
        row.meter,
        formatDuration(row.seconds),
        row.sections ? row.sections.join('; ') : null,
        row.lyrics,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

const mdCell = (value: string | number | null) =>
  (value === null ? '' : String(value)).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** The sheet as Markdown: a table of the cues, then the words each one sings. */
export function cueSheetMarkdown(rows: readonly CueSheetRow[], labels: CueSheetLabels): string {
  const columns = [
    labels.scene,
    labels.cue,
    labels.role,
    labels.music,
    labels.reference,
    labels.key,
    labels.tempo,
    labels.meter,
    labels.duration,
  ];
  const out = [
    `# ${labels.title}`,
    '',
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
  ];
  for (const row of rows) {
    out.push(
      `| ${[
        row.chapter ? `${row.chapter} / ${row.scene}` : row.scene,
        row.cue,
        roleLabel(row, labels),
        row.music ?? labels.gone,
        row.reference,
        row.key,
        row.tempo,
        row.meter,
        formatDuration(row.seconds),
      ]
        .map(mdCell)
        .join(' | ')} |`,
    );
  }
  const sung = rows.filter((row) => row.lyrics);
  if (sung.length > 0) {
    out.push('', `## ${labels.lyrics}`);
    for (const row of sung) {
      const sectionsNote = row.sections ? ` (${row.sections.join(', ')})` : '';
      out.push('', `### ${row.scene}: ${row.music ?? labels.gone}${sectionsNote}`, '');
      out.push(...(row.lyrics ?? '').split('\n').map((line) => (line === '' ? '>' : `> ${line}`)));
    }
  }
  return `${out.join('\n')}\n`;
}
