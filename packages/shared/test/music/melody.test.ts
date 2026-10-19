import { describe, expect, it } from 'vitest';
import { parseChordPro } from '../../music/chordpro';
import {
  abcNoteName,
  appendNote,
  removeLastNote,
  lengthToken,
  noteToken,
  parseLength,
  parseMelody,
  pitchLabel,
  transposeMelody,
} from '../../music/melody';
import { buildTimeline, resolveMelodies } from '../../music/timeline';

const pitches = (text: string) => parseMelody(text).sections[0].notes.map((note) => note.pitch);

describe('parseMelody', () => {
  it('reads the letters as pitches, the middle C being 60', () => {
    expect(pitches('C D E F G A B c')).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it('moves a note by octave marks and by sharps, flats and naturals on that note alone', () => {
    expect(pitches("C, C c c'")).toEqual([48, 60, 72, 84]);
    expect(pitches('^F _B =E ^^C __D')).toEqual([66, 70, 64, 62, 60]);
  });

  it('measures lengths in the unit, a quarter note unless L: says otherwise', () => {
    const { sections } = parseMelody('C D2 E/2 F3/2 G/');
    expect(sections[0].notes.map((n) => [n.start, n.duration])).toEqual([
      [0, 1],
      [1, 2],
      [3, 0.5],
      [3.5, 1.5],
      [5, 0.5],
    ]);
    expect(parseMelody('L:1/8\nC D2').sections[0].notes.map((n) => n.duration)).toEqual([0.5, 1]);
  });

  it('keeps rests as events that sing nothing', () => {
    const [section] = parseMelody('C z2 D').sections;
    expect(section.notes.map((n) => [n.pitch, n.syllable])).toEqual([
      [60, 0],
      [null, null],
      [62, 1],
    ]);
    expect(section.syllables).toBe(2);
    expect(section.length).toBe(4);
  });

  it('puts the notes of a slur on one syllable', () => {
    const [section] = parseMelody('(C D E) F').sections;
    expect(section.syllables).toBe(2);
    expect(section.notes.map((n) => [n.syllable, n.carries])).toEqual([
      [0, false],
      [0, true],
      [0, true],
      [1, false],
    ]);
  });

  it('joins a tie into one longer note, and sings one syllable for it', () => {
    const [section] = parseMelody('C2- C D').sections;
    expect(section.notes.map((n) => [n.pitch, n.duration])).toEqual([
      [60, 3],
      [62, 1],
    ]);
    expect(section.syllables).toBe(2);
  });

  it('reads the fields, and starts a section at each P: line', () => {
    const melody = parseMelody(
      'M:3/4\nQ:1/4=120\nK:G\nL:1/8\nP:Verse\nG A B\n% a comment\nP:Chorus\nd2 | c2',
    );
    expect(melody.header).toEqual({ meter: '3/4', tempo: 120, key: 'G', unit: 0.5 });
    expect(melody.sections.map((s) => [s.label, s.notes.length])).toEqual([
      ['Verse', 3],
      ['Chorus', 2],
    ]);
    expect(melody.errors).toEqual([]);
  });

  it('puts notes before any P: line in a section of no label', () => {
    expect(parseMelody('C D').sections.map((s) => s.label)).toEqual([null]);
  });

  it('ignores bar lines, whatever their form', () => {
    expect(pitches('C D | E F |] G :| |: A ||')).toEqual([60, 62, 64, 65, 67, 69]);
  });

  it('never throws: it skips what it cannot read and lists it', () => {
    const melody = parseMelody('C ? D\nE (F\nG) )');
    expect(melody.sections[0].notes.map((n) => n.pitch)).toEqual([60, 62, 64, 65, 67]);
    expect(melody.errors.map((e) => [e.line, e.token, e.reason])).toEqual([
      [1, '?', 'unknown-token'],
      [3, ')', 'stray-slur'],
    ]);
  });

  it('says a slur is unclosed and a tie goes nowhere', () => {
    expect(parseMelody('(C D').errors.map((e) => e.reason)).toEqual(['unclosed-slur']);
    expect(parseMelody('C- D').errors.map((e) => e.reason)).toEqual(['tie-to-nothing']);
    expect(parseMelody('C- z').errors.map((e) => e.reason)).toEqual(['tie-to-nothing']);
    expect(parseMelody('C-').errors.map((e) => e.reason)).toEqual(['tie-to-nothing']);
  });

  it('reads an empty text as no sections', () => {
    expect(parseMelody('')).toEqual({
      header: { meter: null, tempo: null, key: null, unit: 1 },
      sections: [],
      errors: [],
    });
  });
});

describe('writing notes', () => {
  it('spells a pitch as ABC does, in sharps or in flats', () => {
    expect(abcNoteName(60, false)).toBe('C');
    expect(abcNoteName(61, false)).toBe('^C');
    expect(abcNoteName(61, true)).toBe('_D');
    expect(abcNoteName(72, false)).toBe('c');
    expect(abcNoteName(84, false)).toBe("c'");
    expect(abcNoteName(47, false)).toBe('B,,');
  });

  it('writes what it reads back to the same pitch for every note in range', () => {
    for (let pitch = 36; pitch <= 96; pitch += 1) {
      for (const flats of [false, true]) {
        expect(parseMelody(abcNoteName(pitch, flats)).sections[0].notes[0].pitch).toBe(pitch);
      }
    }
  });

  it('writes lengths the way they are read', () => {
    for (const text of ['', '2', '3', '/2', '/4', '3/2', '3/4', '/3', '2/3']) {
      expect(lengthToken(parseLength(text))).toBe(text);
    }
    expect(lengthToken(1, 0.5)).toBe('2');
    expect(lengthToken(0.3333333)).toBe('/3');
  });

  it('writes a note or a rest as one token', () => {
    expect(noteToken(61, 1.5, true)).toBe('_D3/2');
    expect(noteToken(null, 2)).toBe('z2');
  });

  it('names a pitch as a key does', () => {
    expect(pitchLabel(60)).toBe('C4');
    expect(pitchLabel(70, true)).toBe('Bb4');
  });
});

describe('transposeMelody', () => {
  it('moves every note and leaves fields, comments and lengths alone', () => {
    const text = 'K:C\nP:Verse\nC D2 | E/2 z F-\n% C D';
    expect(transposeMelody(text, 2, false)).toBe('K:C\nP:Verse\nD E2 | ^F/2 z G-\n% C D');
  });

  it('respells in flats when asked, across the octave line', () => {
    expect(transposeMelody('B c', 1, true)).toBe('c _d');
    expect(transposeMelody('C', -1, false)).toBe('B,');
    expect(transposeMelody('C', 0, false)).toBe('C');
  });

  it('keeps the pitches a fixed distance apart', () => {
    const before = pitches('C ^D g, a2');
    const after = pitches(transposeMelody('C ^D g, a2', 5, false));
    expect(after.map((pitch, i) => (pitch as number) - (before[i] as number))).toEqual([
      5, 5, 5, 5,
    ]);
  });
});

const SONG = [
  '{sov: Verse 1}',
  'One two three four',
  '{eov}',
  '{soc: Chorus}',
  'La la la',
  '{eoc}',
  '{sov: Verse 2}',
  'Five six nine ten',
  '{eov}',
].join('\n');
const song = () => parseChordPro(SONG);

describe('resolveMelodies', () => {
  it('gives a section its own tune, and the next of its kind the one before it', () => {
    const melody = parseMelody('P:Verse 1\nC D E F\nP:Chorus\ng a b');
    const [one, chorus, two] = resolveMelodies(song(), melody, 'en');

    expect(one).toMatchObject({ label: 'Verse 1', inheritedFrom: null, alignment: 'match' });
    expect(chorus).toMatchObject({ label: 'Chorus', inheritedFrom: null, alignment: 'match' });
    expect(two).toMatchObject({ label: 'Verse 2', inheritedFrom: 'Verse 1', alignment: 'match' });
    expect(two.melody).toBe(one.melody);
  });

  it('sings every verse to the tune that has no label', () => {
    const [one, chorus, two] = resolveMelodies(song(), parseMelody('C D E F'), 'en');

    expect(one.alignment).toBe('match');
    expect(two.alignment).toBe('match');
    expect(chorus.alignment).toBe('none');
  });

  it('gives a chorus nothing rather than a verse’s tune', () => {
    const [, chorus] = resolveMelodies(song(), parseMelody('P:Verse 1\nC D E F'), 'en');

    expect(chorus.melody).toBeNull();
    expect(chorus.alignment).toBe('none');
  });

  it('says when the notes and the syllables do not meet', () => {
    const [short, , long] = resolveMelodies(
      song(),
      parseMelody('P:Verse 1\nC D E\nP:Verse 2\nC D E F G'),
      'en',
    );

    expect(short.alignment).toBe('short');
    expect(long.alignment).toBe('long');
  });

  it('counts a slurred group as one syllable', () => {
    const [one] = resolveMelodies(song(), parseMelody('(C D) E F G'), 'en');

    expect(one.alignment).toBe('match');
  });

  it('skips sections that have no words', () => {
    const parsed = parseChordPro('{sov: Intro}\n[G]\n{eov}\n{sov: Verse 1}\nOne two\n{eov}');

    expect(resolveMelodies(parsed, parseMelody('C D'), 'en').map((r) => r.label)).toEqual([
      'Verse 1',
    ]);
  });
});

describe('buildTimeline', () => {
  const options = { language: 'en' as const, tempo: 120, meter: '4/4' };

  it('is empty without a tune', () => {
    const timeline = buildTimeline(song(), parseMelody(''), options);

    expect(timeline.notes).toEqual([]);
    expect(timeline.beats).toBe(0);
    expect(timeline.seconds).toBe(0);
  });

  it('measures the lines by the syllables they hold', () => {
    const parsed = parseChordPro('{sov: Verse 1}\nOne two\nThree four\n{eov}');
    const { lines, notes } = buildTimeline(parsed, parseMelody('C D E F'), options);

    expect(lines.map((l) => [l.text, l.start, l.end])).toEqual([
      ['One two', 0, 2],
      ['Three four', 2, 4],
    ]);
    expect(notes.map((n) => n.start)).toEqual([0, 1, 2, 3]);
  });

  it('starts the next section on the next bar, and says how long it all runs', () => {
    const parsed = parseChordPro(
      '{sov: Verse 1}\nOne two three\n{eov}\n{sov: Verse 2}\nFour five six\n{eov}',
    );
    const timeline = buildTimeline(parsed, parseMelody('C D E'), options);

    expect(timeline.notes.map((n) => n.start)).toEqual([0, 1, 2, 4, 5, 6]);
    expect(timeline.beats).toBe(8);
    expect(timeline.seconds).toBe(4);
  });

  it('plays one section alone', () => {
    const timeline = buildTimeline(song(), parseMelody('P:Verse 1\nC D E F\nP:Chorus\ng a b'), {
      ...options,
      onlySection: 1,
    });

    expect(timeline.notes.map((n) => n.pitch)).toEqual([79, 81, 83]);
    expect(timeline.notes[0].start).toBe(0);
  });

  it('stops at the time asked', () => {
    const timeline = buildTimeline(song(), parseMelody('C D E F'), { ...options, maxSeconds: 2 });

    expect(timeline.beats).toBeLessThanOrEqual(4);
    expect(timeline.notes.every((n) => n.start < 4)).toBe(true);
  });

  it('takes tempo and meter from the tune before the song', () => {
    const timeline = buildTimeline(song(), parseMelody('M:3/4\nQ:60\nC D E'), options);

    expect(timeline.tempo).toBe(60);
    expect(timeline.meter).toBe('3/4');
  });

  it('sings a chorus again where the words say {chorus}', () => {
    const parsed = parseChordPro(
      '{sov: Verse 1}\nOne two\n{eov}\n{soc: Chorus}\nLa la\n{eoc}\n{sov: Verse 2}\nThree four\n{chorus}\n{eov}',
    );
    const timeline = buildTimeline(parsed, parseMelody('P:Verse 1\nC D\nP:Chorus\ng a'), options);

    expect(timeline.notes.filter((n) => n.pitch === 79).length).toBe(2);
  });

  it('leaves the lines the tune has no notes for without a span', () => {
    const parsed = parseChordPro('{sov: Verse 1}\nOne two\nThree four\n{eov}');
    const { lines } = buildTimeline(parsed, parseMelody('C D E'), options);

    expect(lines.map((l) => l.text)).toEqual(['One two', 'Three four']);
    expect(lines[1].end).toBe(3);
  });

  it('marks the notes of a slur after the first as not beginning a syllable', () => {
    const parsed = parseChordPro('{sov: Verse 1}\nOne two\n{eov}');
    const { notes } = buildTimeline(parsed, parseMelody('(C D) E'), options);

    expect(notes.map((n) => n.sung)).toEqual([true, false, true]);
  });
});

describe('the keyboard writing into the text', () => {
  it('starts a section when the text has none, and adds to the end of the tune after that', () => {
    let text = appendNote('', null, 'C');
    text = appendNote(text, null, 'D2');

    expect(text).toBe('C D2');
    expect(parseMelody(text).sections[0].notes.map((n) => n.pitch)).toEqual([60, 62]);
  });

  it('adds a P: line for a section that is not there yet', () => {
    const text = appendNote(appendNote('', 'Verse 1', 'C'), 'Chorus', 'g');

    expect(text).toBe('P:Verse 1\nC\nP:Chorus\ng');
  });

  it('adds to the right section, not the last', () => {
    const text = appendNote('P:A\nC D\nP:B\nE', 'A', 'F');

    expect(text).toBe('P:A\nC D F\nP:B\nE');
  });

  it('puts the unlabelled tune before the first labelled one', () => {
    expect(appendNote('P:A\nC', null, 'G')).toBe('G\nP:A\nC');
    expect(appendNote('K:G\nP:A\nC', null, 'G')).toBe('K:G\nG\nP:A\nC');
  });

  it('adds to an empty section under its P: line', () => {
    expect(appendNote('P:A\nP:B\nE', 'A', 'F')).toBe('P:A\nF\nP:B\nE');
  });

  it('removes the last note of a section, and the line when it was the only one', () => {
    expect(removeLastNote('P:A\nC D E | \nP:B\nE', 'A')).toBe('P:A\nC D\nP:B\nE');
    expect(removeLastNote('P:A\nC\nP:B\nE', 'A')).toBe('P:A\nP:B\nE');
    expect(removeLastNote('P:A\nC', 'Z')).toBe('P:A\nC');
    expect(removeLastNote('', null)).toBe('');
  });

  it('writes back what the parser reads', () => {
    let text = '';
    for (const token of ['C', 'D', 'z', 'E2']) text = appendNote(text, 'Verse 1', token);

    expect(parseMelody(text).sections[0].notes.map((n) => n.pitch)).toEqual([60, 62, null, 64]);
  });
});

describe('timeline lines and the sheet', () => {
  it('names the line by its place among all the lines of the section, blank ones included', () => {
    const parsed = parseChordPro('{sov: Verse 1}\nOne two\n\n{comment: slow}\nThree four\n{eov}');
    const { lines } = buildTimeline(parsed, parseMelody('C D E F'), {
      language: 'en',
      tempo: 120,
      meter: '4/4',
    });

    expect(lines.map((l) => [l.lineIndex, l.sourceIndex])).toEqual([
      [0, 0],
      [1, 3],
    ]);
  });
});
