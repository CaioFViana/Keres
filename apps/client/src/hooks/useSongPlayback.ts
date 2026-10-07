import {
  buildBacking,
  type ParsedSong,
  buildTimeline,
  defaultFeel,
  type Feel,
  type Instrument,
  parseChordPro,
  parseMelody,
  quarterBeatsPerBar,
  type SectionWords,
  type SyllableLanguage,
  type Timeline,
  type TimelineLine,
  type VoiceTimbre,
} from '@keres/shared';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSongAudioService } from '../services/SongAudioService';
import { PREVIEW_MAX_SECONDS } from '../utils/songPlayback';

export type PlaybackPhase = 'idle' | 'preparing' | 'playing';

export type PlaybackScope =
  | { kind: 'song' }
  | { kind: 'section'; index: number }
  /** The sections of the song a scene sings, by label; `null` is the whole song. */
  | { kind: 'parts'; labels: readonly string[] | null };

export interface PlaybackVoice {
  timbre: VoiceTimbre;
  /** A click on each beat, mixed into the audio. */
  click: boolean;
  /** What plays the chords under the voice; none leaves the voice alone. */
  instrument?: Instrument | null;
  /** The way it plays them; `auto` takes it from the meter. */
  feel?: Feel | 'auto';
}

export interface SongPlaybackInput {
  lyrics: string;
  melody: string;
  tempo: number | null;
  meter: string | null;
  words: SectionWords;
  language: SyllableLanguage;
}

/** The line being sung: where it stands among the sections and lines of the lyrics. */
export interface ActiveLine {
  sectionIndex: number;
  sourceIndex: number;
  text: string;
}

export type PlaybackProblem = 'no-tune' | 'failed';

/** The place in the song of each section a scene names; one the lyrics no longer have is left out. */
function partIndexes(song: ParsedSong, labels: readonly string[]): number[] {
  const wanted = new Set(labels);
  const found = song.sections.flatMap((section, index) =>
    section.label && wanted.has(section.label) ? [index] : [],
  );
  // Nothing named is left: the whole song stands in, as it does in print.
  return found.length > 0 ? found : song.sections.map((_, index) => index);
}

/** The line sung at `beat`, held through the short rests between lines but not past the next gap. */
export function lineAt(lines: readonly TimelineLine[], beat: number): TimelineLine | null {
  let found: TimelineLine | null = null;
  for (const line of lines) {
    if (line.start > beat) break;
    found = line;
  }
  return found && beat <= found.end + 2 ? found : null;
}

/**
 * Plays a song's tune hummed: builds what is sung (a section, or the first minute and a half),
 * renders it in slices and plays the file, following the words as it goes. Nothing is parsed or
 * rendered until the person asks to hear it; a tune already heard is not rendered again.
 */
export function useSongPlayback(defaults?: SongPlaybackInput) {
  const player = useAudioPlayer(undefined, { updateInterval: 120 });
  const tonePlayer = useAudioPlayer(undefined);
  const status = useAudioPlayerStatus(player);
  const service = useMemo(() => createSongAudioService(), []);
  const [phase, setPhase] = useState<PlaybackPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [problem, setProblem] = useState<PlaybackProblem | null>(null);
  const [active, setActive] = useState<ActiveLine | null>(null);
  /** What the person asked to hear (`play`'s `tag`), so a list of things to hear can say which one sounds. */
  const [tag, setTag] = useState<string | null>(null);
  const timeline = useRef<Timeline | null>(null);
  const run = useRef(0);
  const toneRun = useRef(0);

  useEffect(() => {
    // A phone in silent mode would otherwise play nothing: this is the point of pressing play.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const stop = useCallback(() => {
    run.current += 1;
    try {
      player.pause();
    } catch {
      // The player may already be gone with its screen.
    }
    setPhase('idle');
    setProgress(0);
    setActive(null);
    setTag(null);
  }, [player]);

  useEffect(
    () => () => {
      run.current += 1;
      toneRun.current += 1;
    },
    [],
  );

  const play = useCallback(
    async (
      scope: PlaybackScope,
      voice: PlaybackVoice,
      options: { input?: SongPlaybackInput; tag?: string } = {},
    ) => {
      const input = options.input ?? defaults;
      if (!input) return;
      const mine = ++run.current;
      setProblem(null);
      setActive(null);
      setTag(options.tag ?? null);
      try {
        player.pause();
      } catch {
        // Nothing playing yet.
      }
      const parsed = parseChordPro(input.lyrics, input.words);
      const built = buildTimeline(parsed, parseMelody(input.melody), {
        language: input.language,
        tempo: input.tempo,
        meter: input.meter,
        ...(scope.kind === 'section'
          ? { onlySection: scope.index }
          : scope.kind === 'parts' && scope.labels && scope.labels.length > 0
            ? { onlySections: partIndexes(parsed, scope.labels), maxSeconds: PREVIEW_MAX_SECONDS }
            : { maxSeconds: PREVIEW_MAX_SECONDS }),
      });
      const instrument = voice.instrument ?? null;
      const backingNotes = instrument
        ? buildBacking(built.chords, {
            instrument,
            feel: voice.feel && voice.feel !== 'auto' ? voice.feel : defaultFeel(built.meter),
            meter: built.meter,
          })
        : [];
      // Chords alone are a song to hear too: a tune is not needed when an instrument has something to play.
      if (built.notes.length === 0 && backingNotes.length === 0) {
        setProblem('no-tune');
        setPhase('idle');
        setTag(null);
        return;
      }
      timeline.current = built;
      setPhase('preparing');
      setProgress(0);
      try {
        const rendered = await service.render(
          {
            notes: built.notes,
            beats: built.beats,
            tempo: built.tempo,
            ...(instrument && backingNotes.length > 0
              ? { backing: { instrument, notes: backingNotes } }
              : {}),
          },
          {
            timbre: voice.timbre,
            ...(voice.click ? { clickBeatsPerBar: quarterBeatsPerBar(built.meter) } : {}),
          },
          {
            onProgress: (fraction) => {
              if (run.current === mine) setProgress(fraction);
            },
            isCancelled: () => run.current !== mine,
          },
        );
        if (!rendered || run.current !== mine) return;
        player.replace({ uri: rendered.uri });
        player.play();
        setPhase('playing');
      } catch (error) {
        console.log('useSongPlayback: could not prepare the song.', error);
        if (run.current === mine) {
          setProblem('failed');
          setPhase('idle');
          setTag(null);
        }
      }
    },
    [defaults, player, service],
  );

  // The words follow the sound: the line is found from the player's clock, a few times a second.
  const lines = timeline.current?.lines;
  const tempo = timeline.current?.tempo ?? 90;
  useEffect(() => {
    if (phase !== 'playing') return;
    if (status.didJustFinish) {
      setPhase('idle');
      setActive(null);
      return;
    }
    if (!status.playing || !lines) return;
    const line = lineAt(lines, (status.currentTime * tempo) / 60);
    setActive((current) =>
      (current?.sectionIndex ?? -1) === (line?.sectionIndex ?? -1) &&
      (current?.sourceIndex ?? -1) === (line?.sourceIndex ?? -1)
        ? current
        : line
          ? { sectionIndex: line.sectionIndex, sourceIndex: line.sourceIndex, text: line.text }
          : null,
    );
  }, [phase, status.didJustFinish, status.playing, status.currentTime, lines, tempo]);

  const playTone = useCallback(
    async (pitch: number, timbre: VoiceTimbre) => {
      const mine = ++toneRun.current;
      try {
        const uri = await service.tone(pitch, timbre);
        if (toneRun.current !== mine) return;
        tonePlayer.replace({ uri });
        tonePlayer.play();
      } catch (error) {
        console.log('useSongPlayback: could not play the key.', error);
      }
    },
    [service, tonePlayer],
  );

  return { phase, progress, problem, active, tag, play, stop, playTone };
}
