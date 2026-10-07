import { parseMeter } from './songStats';
import type { Timeline } from './timeline';

/** Ticks in a quarter note: fine enough for a sixteenth triplet to land on a whole tick. */
const TICKS_PER_QUARTER = 480;
/** "Voice Oohs": what a program-changing player shows for a sung line. */
const VOICE_PROGRAM = 53;
const VELOCITY = 88;

const encoder = new TextEncoder();

function variableLength(value: number): number[] {
  let rest = Math.max(0, Math.round(value));
  const bytes = [rest & 0x7f];
  while ((rest >>= 7) > 0) bytes.unshift((rest & 0x7f) | 0x80);
  return bytes;
}

const meta = (type: number, data: number[]) => [
  0xff,
  type,
  ...variableLength(data.length),
  ...data,
];
const word = (value: number, bytes: number) =>
  Array.from({ length: bytes }, (_, i) => (value >> (8 * (bytes - 1 - i))) & 0xff);

interface TimedEvent {
  tick: number;
  /** Ends a note before a new one begins on the same tick. */
  order: number;
  bytes: number[];
}

export interface MidiOptions {
  title: string;
}

/**
 * The tune as a Standard MIDI File (format 0, one track): tempo, time signature, the notes, and each
 * line of the words as a lyric event at the moment it starts, which is what karaoke players read.
 * The same events that play in the app, so the file and the preview cannot disagree.
 */
export function writeMidi(timeline: Timeline, options: MidiOptions): Uint8Array {
  const tick = (beats: number) => Math.round(beats * TICKS_PER_QUARTER);
  const { beats: numerator, unit } = parseMeter(timeline.meter);
  const events: TimedEvent[] = [];

  for (const note of timeline.notes) {
    const start = tick(note.start);
    const end = Math.max(start + 1, tick(note.start + note.duration));
    events.push({ tick: start, order: 1, bytes: [0x90, note.pitch & 0x7f, VELOCITY] });
    events.push({ tick: end, order: 0, bytes: [0x80, note.pitch & 0x7f, 0] });
  }
  for (const line of timeline.lines) {
    events.push({
      tick: tick(line.start),
      order: 2,
      bytes: meta(0x05, [...encoder.encode(line.text)]),
    });
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track: number[] = [
    0,
    ...meta(0x03, [...encoder.encode(options.title)]),
    0,
    ...meta(0x58, [numerator, Math.log2(unit), 24, 8]),
    0,
    ...meta(0x51, word(Math.round(60_000_000 / timeline.tempo), 3)),
    0,
    0xc0,
    VOICE_PROGRAM,
  ];
  let previous = 0;
  for (const event of events) {
    track.push(...variableLength(event.tick - previous), ...event.bytes);
    previous = event.tick;
  }
  track.push(0, ...meta(0x2f, []));

  const header = [
    ...encoder.encode('MThd'),
    ...word(6, 4),
    ...word(0, 2),
    ...word(1, 2),
    ...word(TICKS_PER_QUARTER, 2),
  ];
  return Uint8Array.from([
    ...header,
    ...encoder.encode('MTrk'),
    ...word(track.length, 4),
    ...track,
  ]);
}
