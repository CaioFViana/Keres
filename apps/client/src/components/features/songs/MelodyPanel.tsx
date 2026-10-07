import { Ionicons } from '@expo/vector-icons';
import {
  appendNote,
  FEELS,
  formatDuration,
  type Feel,
  INSTRUMENTS,
  type Instrument,
  MAX_SONG_MELODY_LENGTH,
  noteToken,
  parseChordPro,
  parseMelody,
  keyPrefersFlats,
  removeLastNote,
  resolveMelodies,
  songSeconds,
  type SectionWords,
  type SyllableLanguage,
  type VoiceTimbre,
} from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import type {
  ActiveLine,
  PlaybackPhase,
  PlaybackProblem,
  PlaybackScope,
} from '@/src/hooks/useSongPlayback';
import { PREVIEW_MAX_SECONDS } from '@/src/utils/songPlayback';
import { useTheme } from '@/src/theme';
import PianoKeys from './PianoKeys';

interface MelodyPanelProps {
  lyrics: string;
  melody: string;
  songKey: string | null;
  tempo: number | null;
  meter: string | null;
  editable: boolean;
  words: SectionWords;
  language: SyllableLanguage;
  onChange: (melody: string) => void;
  onBlur: () => void;
  phase: PlaybackPhase;
  progress: number;
  problem: PlaybackProblem | null;
  active: ActiveLine | null;
  onPlay: (
    scope: PlaybackScope,
    voice: {
      timbre: VoiceTimbre;
      click: boolean;
      instrument: Instrument | null;
      feel: Feel | 'auto';
    },
  ) => void;
  onStop: () => void;
  onTone: (pitch: number, timbre: VoiceTimbre) => void;
  onExport: (kind: 'midi' | 'abc') => void;
}

/** Note lengths the keyboard offers, in quarter notes. */
const LENGTHS = [
  { beats: 0.25, label: '¼' },
  { beats: 0.5, label: '½' },
  { beats: 1, label: '1' },
  { beats: 1.5, label: '1½' },
  { beats: 2, label: '2' },
  { beats: 4, label: '4' },
] as const;
const TIMBRES: readonly VoiceTimbre[] = ['hum', 'ah', 'la'];
const BASE_PITCHES = [48, 60, 72] as const;

/**
 * The tune of a song: written as text, played on a keyboard, heard hummed. Everything it shows is
 * worked out from the words and the tune after a pause in typing, and the sound is made only when
 * play is pressed - opening the song costs nothing of this.
 */
const MelodyPanel: React.FC<MelodyPanelProps> = ({
  lyrics,
  melody,
  songKey,
  tempo,
  meter,
  editable,
  words,
  language,
  onChange,
  onBlur,
  phase,
  progress,
  problem,
  active,
  onPlay,
  onStop,
  onTone,
  onExport,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [timbre, setTimbre] = useState<VoiceTimbre>('hum');
  const [click, setClick] = useState(false);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [feel, setFeel] = useState<Feel | 'auto'>('auto');
  const [scope, setScope] = useState<PlaybackScope>({ kind: 'song' });
  const [length, setLength] = useState<number>(1);
  const [base, setBase] = useState<number>(60);
  const [target, setTarget] = useState<string | null>(null);

  const settledLyrics = useDebouncedValue(lyrics);
  const settledMelody = useDebouncedValue(melody);
  const view = useMemo(() => {
    const song = parseChordPro(settledLyrics, words);
    const parsed = parseMelody(settledMelody);
    const length = songSeconds(
      { lyrics: settledLyrics, melody: settledMelody || null, tempo, meter },
      null,
      language,
    );
    return { rows: resolveMelodies(song, parsed, language), errors: parsed.errors, length };
  }, [settledLyrics, settledMelody, words, language, tempo, meter]);

  const labels = view.rows.flatMap((row) => (row.label ? [row.label] : []));
  const writingInto = target && labels.includes(target) ? target : (labels[0] ?? null);
  const flats = songKey ? keyPrefersFlats(songKey) : false;
  const busy = phase === 'preparing';
  const tooLong = melody.length > MAX_SONG_MELODY_LENGTH * 0.9;

  const press = (pitch: number | null) => {
    onChange(appendNote(melody, writingInto, noteToken(pitch, length, flats)));
    if (pitch !== null) onTone(pitch, timbre);
  };

  const styles = StyleSheet.create({
    group: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    chip: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    on: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { color: colors.text, fontSize: 15, marginBottom: 6, marginTop: 14 },
    hint: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
    error: { color: colors.error, fontSize: 12, marginTop: 4 },
    now: { color: colors.primary, fontSize: 16, fontStyle: 'italic', marginVertical: 6 },
    input: {
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      fontSize: 14,
      minHeight: 120,
    },
    status: { fontSize: 13, marginVertical: 1 },
  });

  const chip = (
    id: string,
    text: string,
    selected: boolean,
    onPress: () => void,
    disabled = false,
  ) => (
    <TouchableOpacity
      key={id}
      testID={id}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      style={[styles.chip, selected && styles.on]}
      onPress={onPress}
    >
      <Text style={{ color: selected ? colors.onPrimary : colors.text }}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <View testID="melody-panel">
      <Text style={styles.hint}>{t('melody_hint')}</Text>

      <View style={styles.group}>
        <TouchableOpacity
          testID="melody-play"
          accessibilityRole="button"
          accessibilityLabel={t(phase === 'idle' ? 'melody_play' : 'melody_stop')}
          style={[styles.chip, styles.on]}
          onPress={() =>
            phase === 'idle' ? onPlay(scope, { timbre, click, instrument, feel }) : onStop()
          }
        >
          <Ionicons name={phase === 'idle' ? 'play' : 'stop'} size={16} color={colors.onPrimary} />
          <Text style={{ color: colors.onPrimary }}>
            {busy
              ? t('melody_preparing', { percent: Math.round(progress * 100) })
              : t(phase === 'idle' ? 'melody_play' : 'melody_stop')}
          </Text>
        </TouchableOpacity>
        {chip('melody-click', t('melody_click'), click, () => setClick((on) => !on))}
      </View>

      <View style={styles.group}>
        {chip(
          'melody-scope-song',
          t('melody_scope_song', { seconds: PREVIEW_MAX_SECONDS }),
          scope.kind === 'song',
          () => setScope({ kind: 'song' }),
        )}
        {view.rows.map((row) =>
          chip(
            `melody-scope-${row.sectionIndex}`,
            row.label ?? t('melody_scope_unnamed', { number: row.sectionIndex + 1 }),
            scope.kind === 'section' && scope.index === row.sectionIndex,
            () => setScope({ kind: 'section', index: row.sectionIndex }),
          ),
        )}
      </View>

      <View style={styles.group}>
        {TIMBRES.map((option) =>
          chip(`melody-voice-${option}`, t(`melody_voice_${option}`), timbre === option, () =>
            setTimbre(option),
          ),
        )}
      </View>

      <Text style={styles.hint}>{t('melody_backing_hint')}</Text>
      <View style={styles.group}>
        {chip('melody-instrument-none', t('melody_instrument_none'), instrument === null, () =>
          setInstrument(null),
        )}
        {INSTRUMENTS.map((option) =>
          chip(
            `melody-instrument-${option}`,
            t(`melody_instrument_${option}`),
            instrument === option,
            () => setInstrument(option),
          ),
        )}
      </View>
      {instrument && instrument !== 'violin' ? (
        <View style={styles.group}>
          {(['auto', ...FEELS] as const).map((option) =>
            chip(`melody-feel-${option}`, t(`melody_feel_${option}`), feel === option, () =>
              setFeel(option),
            ),
          )}
        </View>
      ) : null}

      {active ? (
        <Text style={styles.now} testID="melody-now">
          {`♪ ${active.text}`}
        </Text>
      ) : null}
      {problem ? (
        <Text style={styles.error} testID="melody-problem">
          {t(problem === 'no-tune' ? 'melody_no_tune' : 'melody_play_failed')}
        </Text>
      ) : null}

      {view.length.seconds > 0 ? (
        <Text style={styles.hint} testID="melody-length">
          {t(view.length.exact ? 'melody_length' : 'melody_length_estimated', {
            time: formatDuration(view.length.seconds),
          })}
        </Text>
      ) : null}

      {view.rows.length > 0 ? (
        <View testID="melody-status">
          {view.rows.map((row) => {
            const off = row.alignment === 'short' || row.alignment === 'long';
            const notes = row.melody?.syllables ?? 0;
            return (
              <Text
                key={row.sectionIndex}
                style={[styles.status, { color: off ? colors.error : colors.textSecondary }]}
              >
                {row.alignment === 'none'
                  ? t('melody_status_none', { label: row.label ?? row.sectionIndex + 1 })
                  : t(`melody_status_${row.alignment}`, {
                      label: row.label ?? row.sectionIndex + 1,
                      notes,
                      syllables: row.syllables,
                      difference: Math.abs(notes - row.syllables),
                    }) +
                    (row.inheritedFrom
                      ? ` ${t('melody_status_inherited', { from: row.inheritedFrom })}`
                      : '')}
              </Text>
            );
          })}
        </View>
      ) : null}

      {editable ? (
        <>
          <Text style={styles.label}>{t('melody_keyboard')}</Text>
          {labels.length > 0 ? (
            <View style={styles.group}>
              {labels.map((label) =>
                chip(`melody-target-${label}`, label, writingInto === label, () =>
                  setTarget(label),
                ),
              )}
            </View>
          ) : null}
          <View style={styles.group}>
            {LENGTHS.map((option) =>
              chip(`melody-length-${option.beats}`, option.label, length === option.beats, () =>
                setLength(option.beats),
              ),
            )}
          </View>
          <View style={styles.group}>
            {BASE_PITCHES.map((pitch) =>
              chip(
                `melody-octave-${pitch}`,
                `C${Math.floor(pitch / 12) - 1}–C${Math.floor(pitch / 12) + 1}`,
                base === pitch,
                () => setBase(pitch),
              ),
            )}
            {chip('melody-rest', t('melody_rest'), false, () => press(null))}
            <TouchableOpacity
              testID="melody-backspace"
              accessibilityRole="button"
              accessibilityLabel={t('melody_backspace')}
              style={styles.chip}
              onPress={() => onChange(removeLastNote(melody, writingInto))}
            >
              <Ionicons name="backspace-outline" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>
          <PianoKeys firstPitch={base} onKey={press} />
        </>
      ) : null}

      <Text style={styles.label}>{t('melody_text')}</Text>
      <Text style={styles.hint}>{t('melody_text_hint')}</Text>
      <TextInput
        testID="song-melody"
        accessibilityLabel={t('melody_text')}
        value={melody}
        editable={editable}
        multiline
        maxLength={MAX_SONG_MELODY_LENGTH}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        onChangeText={onChange}
        onBlur={onBlur}
      />
      <Text style={[styles.hint, tooLong && { color: colors.error }]}>
        {t('song_lyrics_count', { count: melody.length, max: MAX_SONG_MELODY_LENGTH })}
      </Text>
      {view.errors.length > 0 ? (
        <Text style={styles.error} testID="melody-errors">
          {t('melody_errors', {
            count: view.errors.length,
            line: view.errors[0].line,
            token: view.errors[0].token,
          })}
        </Text>
      ) : null}

      <View style={[styles.group, { marginTop: 10 }]}>
        {chip('melody-export-midi', t('melody_export_midi'), false, () => onExport('midi'))}
        {chip('melody-export-abc', t('melody_export_abc'), false, () => onExport('abc'))}
      </View>
    </View>
  );
};

export default MelodyPanel;
