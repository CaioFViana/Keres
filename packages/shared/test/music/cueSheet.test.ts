import { describe, expect, it } from 'vitest';
import {
  type CueSheetLabels,
  type CueSheetRow,
  cueSheetCsv,
  cueSheetMarkdown,
  formatDuration,
  songSeconds,
  sungWords,
} from '../../music/cueSheet';

const LYRICS = [
  '{sov: Verse 1}',
  '[G]One two [C]three four',
  '{eov}',
  '{soc: Chorus}',
  '[D]La la',
  '{eoc}',
].join('\n');

const labels: CueSheetLabels = {
  title: 'Cue sheet',
  scene: 'Scene',
  chapter: 'Chapter',
  cue: 'Cue',
  role: 'Role',
  music: 'Music',
  reference: 'Reference',
  key: 'Key',
  tempo: 'Tempo',
  meter: 'Meter',
  duration: 'Length',
  sections: 'Sections',
  lyrics: 'Words',
  inWorld: 'Heard',
  score: 'Soundtrack',
  gone: '(gone)',
};

const row = (overrides: Partial<CueSheetRow> = {}): CueSheetRow => ({
  scene: 'The tavern',
  chapter: 'One',
  cue: 'as the door opens',
  role: 'in-world',
  music: 'The Lantern Song',
  kind: 'song',
  reference: null,
  key: 'G',
  tempo: 90,
  meter: '4/4',
  seconds: 65,
  sections: ['Chorus'],
  lyrics: 'La la',
  ...overrides,
});

describe('formatDuration', () => {
  it('writes minutes and seconds, and nothing for a length not known', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(3599.6)).toBe('60:00');
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(Number.NaN)).toBe('');
  });
});

describe('songSeconds', () => {
  it('estimates from the chords, a bar each, when there is no tune', () => {
    // Three chords at 120 bpm in 4/4: three bars of two seconds.
    expect(
      songSeconds({ lyrics: LYRICS, melody: null, tempo: 120, meter: '4/4' }, null, 'en'),
    ).toEqual({
      seconds: 6,
      exact: false,
    });
  });

  it('counts only the sections a scene sings', () => {
    expect(
      songSeconds({ lyrics: LYRICS, melody: null, tempo: 120, meter: '4/4' }, ['Chorus'], 'en'),
    ).toEqual({ seconds: 2, exact: false });
  });

  it('estimates two bars a line when the song has no chords', () => {
    expect(
      songSeconds(
        { lyrics: 'One two\nThree four', melody: null, tempo: 120, meter: '4/4' },
        null,
        'en',
      ),
    ).toEqual({ seconds: 8, exact: false });
  });

  it('measures the tune when there is one, section by section', () => {
    const song = {
      lyrics: LYRICS,
      melody: 'P:Verse 1\nC D E F\nP:Chorus\ng a',
      tempo: 120,
      meter: '4/4',
    };

    // Verse: one bar (2 s). Chorus: one bar (2 s).
    expect(songSeconds(song, null, 'en')).toEqual({ seconds: 4, exact: true });
    expect(songSeconds(song, ['Chorus'], 'en')).toEqual({ seconds: 2, exact: true });
  });

  it('falls back to the estimate when the tune says nothing of the sections asked for', () => {
    const song = { lyrics: LYRICS, melody: 'P:Verse 1\nC D E F', tempo: 120, meter: '4/4' };

    expect(songSeconds(song, ['Chorus'], 'en').exact).toBe(false);
  });
});

describe('sungWords', () => {
  it('gives the lines without chords, a blank line between sections', () => {
    expect(sungWords(LYRICS, null)).toBe('One two three four\n\nLa la');
    expect(sungWords(LYRICS, ['Chorus'])).toBe('La la');
  });

  it('gives the whole song when every section asked for is gone', () => {
    expect(sungWords(LYRICS, ['Bridge'])).toBe('One two three four\n\nLa la');
  });
});

describe('cueSheetCsv', () => {
  it('writes a header and a line a cue, with the role and the music in words', () => {
    const csv = cueSheetCsv([row()], labels);
    const lines = csv.slice(1).split('\r\n');

    expect(csv.startsWith('﻿')).toBe(true);
    expect(lines[0]).toBe(
      'Scene,Chapter,Cue,Role,Music,Reference,Key,Tempo,Meter,Length,Sections,Words',
    );
    expect(lines[1]).toBe(
      'The tavern,One,as the door opens,Heard,The Lantern Song,,G,90,4/4,1:05,Chorus,La la',
    );
  });

  it('quotes what holds a comma, a quote or a line break', () => {
    const csv = cueSheetCsv(
      [row({ cue: 'a, "b"', lyrics: 'One\ntwo', sections: ['Verse 1', 'Chorus'] })],
      labels,
    );

    expect(csv).toContain('"a, ""b"""');
    expect(csv).toContain('"One\ntwo"');
    expect(csv).toContain('Verse 1; Chorus');
  });

  it('keeps a spreadsheet from running a formula a person wrote', () => {
    const csv = cueSheetCsv([row({ cue: '=HYPERLINK("x")', music: '-1+1' })], labels);

    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("'-1+1");
  });

  it('says a piece of music is gone, and gives a medium its reference', () => {
    const csv = cueSheetCsv(
      [row({ music: null, kind: 'medium', role: 'score', reference: 'https://example.org/a' })],
      labels,
    );

    expect(csv).toContain(',Soundtrack,(gone),https://example.org/a,');
  });

  it('is only the header for a story with no music', () => {
    expect(cueSheetCsv([], labels).trim().split('\r\n')).toHaveLength(1);
  });
});

describe('cueSheetMarkdown', () => {
  it('writes a table and then the words each cue sings', () => {
    const text = cueSheetMarkdown([row()], labels);

    expect(text).toContain('# Cue sheet');
    expect(text).toContain(
      '| Scene | Cue | Role | Music | Reference | Key | Tempo | Meter | Length |',
    );
    expect(text).toContain(
      '| One / The tavern | as the door opens | Heard | The Lantern Song |  | G | 90 | 4/4 | 1:05 |',
    );
    expect(text).toContain('### The tavern: The Lantern Song (Chorus)');
    expect(text).toContain('> La la');
  });

  it('does not let a pipe or a line break in a cue break the table', () => {
    const text = cueSheetMarkdown([row({ cue: 'a | b\nc' })], labels);

    expect(text).toContain('a \\| b c');
  });

  it('leaves out the words of a soundtrack and of a cue without any', () => {
    const text = cueSheetMarkdown([row({ lyrics: null, role: 'score' })], labels);

    expect(text).not.toContain('## Words');
    expect(text).toContain('Soundtrack');
  });
});
