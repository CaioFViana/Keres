import { describe, expect, it } from 'vitest';
import { writeAbc } from '../../music/abc';
import { parseChordPro } from '../../music/chordpro';
import { buildTimeline, parseMelody } from '../../music/melody';
import { writeMidi } from '../../music/midi';

const WORDS = '{sov: Verse 1}\nTwin·kle twin·kle\nLit·tle star\n{eov}';
const song = () => parseChordPro(WORDS);
const options = { language: 'en' as const, tempo: 120, meter: '4/4' };

const text = (bytes: Uint8Array, from: number, length: number) =>
  new TextDecoder().decode(bytes.slice(from, from + length));
const u32 = (bytes: Uint8Array, at: number) =>
  (bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3];

/** Walks the events of the one track: absolute tick, status byte and data. */
function events(bytes: Uint8Array) {
  let at = 22;
  let tick = 0;
  const found: { tick: number; status: number; data: number[] }[] = [];
  const end = at + u32(bytes, 18);
  let status = 0;
  while (at < end) {
    let delta = 0;
    while (bytes[at] & 0x80) delta = (delta << 7) | (bytes[at++] & 0x7f);
    delta = (delta << 7) | bytes[at++];
    tick += delta;
    if (bytes[at] === 0xff) {
      const type = bytes[at + 1];
      let length = 0;
      let cursor = at + 2;
      while (bytes[cursor] & 0x80) length = (length << 7) | (bytes[cursor++] & 0x7f);
      length = (length << 7) | bytes[cursor++];
      found.push({ tick, status: 0xff00 | type, data: [...bytes.slice(cursor, cursor + length)] });
      at = cursor + length;
    } else {
      if (bytes[at] & 0x80) status = bytes[at++];
      const size = (status & 0xf0) === 0xc0 ? 1 : 2;
      found.push({ tick, status, data: [...bytes.slice(at, at + size)] });
      at += size;
    }
  }
  return found;
}

describe('writeMidi', () => {
  const timeline = buildTimeline(song(), parseMelody('C C G G | A A G2'), options);
  const bytes = writeMidi(timeline, { title: 'Star' });

  it('writes a format 0 file with one track and 480 ticks to the quarter note', () => {
    expect(text(bytes, 0, 4)).toBe('MThd');
    expect(u32(bytes, 4)).toBe(6);
    expect([bytes[8], bytes[9]]).toEqual([0, 0]);
    expect([bytes[10], bytes[11]]).toEqual([0, 1]);
    expect((bytes[12] << 8) | bytes[13]).toBe(480);
    expect(text(bytes, 14, 4)).toBe('MTrk');
    expect(u32(bytes, 18)).toBe(bytes.length - 22);
  });

  it('states the tempo, the meter and the title', () => {
    const found = events(bytes);
    const tempo = found.find((e) => e.status === 0xff51)!;
    expect((tempo.data[0] << 16) | (tempo.data[1] << 8) | tempo.data[2]).toBe(500000);
    expect(found.find((e) => e.status === 0xff58)!.data).toEqual([4, 2, 24, 8]);
    expect(String.fromCharCode(...found.find((e) => e.status === 0xff03)!.data)).toBe('Star');
    expect(found[found.length - 1]).toMatchObject({ status: 0xff2f });
  });

  it('plays the notes at their ticks and ends each before the next begins', () => {
    const notes = events(bytes).filter(
      (e) => (e.status & 0xf0) === 0x90 || (e.status & 0xf0) === 0x80,
    );
    const ons = notes.filter((e) => e.status === 0x90);

    expect(ons.map((e) => [e.tick, e.data[0]])).toEqual([
      [0, 60],
      [480, 60],
      [960, 67],
      [1440, 67],
      [1920, 69],
      [2400, 69],
      [2880, 67],
    ]);
    const lastOff = notes.filter((e) => e.status === 0x80).pop()!;
    expect(lastOff.tick).toBe(2880 + 960);
  });

  it('carries each line of the words as a lyric at its start', () => {
    const lyrics = events(bytes).filter((e) => e.status === 0xff05);

    expect(lyrics.map((e) => [e.tick, new TextDecoder().decode(Uint8Array.from(e.data))])).toEqual([
      [0, 'Twinkle twinkle'],
      [1920, 'Little star'],
    ]);
  });

  it('writes the same bytes twice', () => {
    expect([...writeMidi(timeline, { title: 'Star' })]).toEqual([...bytes]);
  });

  it('writes a file for a song with no tune', () => {
    const empty = writeMidi(buildTimeline(song(), parseMelody(''), options), { title: 'x' });

    expect(text(empty, 0, 4)).toBe('MThd');
    expect(events(empty).some((e) => e.status === 0x90)).toBe(false);
  });
});

describe('writeAbc', () => {
  const abc = writeAbc(song(), parseMelody('C C G G | A A G2'), {
    title: 'Star',
    key: 'C',
    tempo: 120,
    meter: '4/4',
    language: 'en',
    preferFlats: false,
  });

  it('opens with the fields of a tune', () => {
    expect(abc.split('\n').slice(0, 6)).toEqual([
      'X:1',
      'T:Star',
      'M:4/4',
      'L:1/4',
      'Q:1/4=120',
      'K:C',
    ]);
  });

  it('puts the words under the notes, split where the writer marked the syllables', () => {
    expect(abc).toContain('P:Verse 1');
    expect(abc).toContain('C C G G |\nw: Twin-kle twin-kle');
    expect(abc).toContain('A A G2 |\nw: Lit-tle star');
  });

  it('is read back by the parser to the same notes', () => {
    const notes = parseMelody(
      abc
        .split('\n')
        .filter((l) => !/^(w:|[XTMLQK]:)/.test(l))
        .join('\n'),
    );

    expect(notes.sections[0].notes.map((n) => n.pitch)).toEqual([60, 60, 67, 67, 69, 69, 67]);
  });

  it('splits a note that crosses a bar line into two tied', () => {
    const tied = writeAbc(parseChordPro('{sov: V}\nOne two three\n{eov}'), parseMelody('C D E4'), {
      title: 't',
      key: null,
      tempo: null,
      meter: '4/4',
      language: 'en',
      preferFlats: false,
    });

    expect(tied).toContain('C D E2- | E2\nw:');
  });

  it('writes a slur as parentheses and leaves a section with no tune out', () => {
    const text = writeAbc(
      parseChordPro('{sov: A}\nOne two\n{eov}\n{soc: B}\nLa\n{eoc}'),
      parseMelody('P:A\n(C D) E'),
      { title: 't', key: 'G', tempo: 90, meter: '4/4', language: 'en', preferFlats: false },
    );

    expect(text).toContain('(C D) E');
    expect(text).not.toContain('P:B');
    expect(text).toContain('K:G');
  });
});
