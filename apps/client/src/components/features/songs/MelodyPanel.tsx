import { Ionicons } from '@expo/vector-icons';
import {
  appendNote,
  FEELS,
  type Feel,
  formatDuration,
  INSTRUMENTS,
  type Instrument,
  keyPrefersFlats,
  MAX_SONG_MELODY_LENGTH,
  noteToken,
  parseChordPro,
  parseMelody,
  removeLastNote,
  resolveMelodies,
  type SectionWords,
  songSeconds,
  type SyllableLanguage,
  type VoiceTimbre,
} from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import type {
  ActiveLine,
  PlaybackPhase,
  PlaybackProblem,
  PlaybackScope,
  PlaybackVoice,
} from '@/src/hooks/useSongPlayback';
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
  onPlay: (scope: PlaybackScope, voice: PlaybackVoice) => void;
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
/** The least a thing to touch should be, in points. */
const TOUCH = 44;

/**
 * The tune of a song, in the order a person uses it: hear it first (one big button; the sound
 * options keep to themselves until asked for), then the parts and how their notes meet their words,
 * then the keyboard that writes into the part chosen, and last the notes as text and the files.
 * Everything shown is worked out from the words and the tune after a pause in typing, and the sound is
 * made only when play is pressed - opening the song costs nothing of this.
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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [notationOpen, setNotationOpen] = useState(!editable);
  const [length, setLength] = useState<number>(1);
  const [base, setBase] = useState<number>(60);
  const [target, setTarget] = useState<string | null>(null);

  const settledLyrics = useDebouncedValue(lyrics);
  const settledMelody = useDebouncedValue(melody);
  const view = useMemo(() => {
    const song = parseChordPro(settledLyrics, words);
    const parsed = parseMelody(settledMelody);
    const total = songSeconds(
      { lyrics: settledLyrics, melody: settledMelody || null, tempo, meter },
      null,
      language,
    );
    return { rows: resolveMelodies(song, parsed, language), errors: parsed.errors, total };
  }, [settledLyrics, settledMelody, words, language, tempo, meter]);

  const labels = view.rows.flatMap((row) => (row.label ? [row.label] : []));
  const writingInto = target && labels.includes(target) ? target : (labels[0] ?? null);
  const flats = songKey ? keyPrefersFlats(songKey) : false;
  const busy = phase === 'preparing';
  const voice: PlaybackVoice = { timbre, click, instrument, feel };
  const tooLong = melody.length > MAX_SONG_MELODY_LENGTH * 0.9;

  const press = (pitch: number | null) => {
    onChange(appendNote(melody, writingInto, noteToken(pitch, length, flats)));
    if (pitch !== null) onTone(pitch, timbre);
  };

  const summary = [
    t(`melody_voice_${timbre}`),
    instrument
      ? feel !== 'auto' && instrument !== 'violin'
        ? `${t(`melody_instrument_${instrument}`)}, ${t(`melody_feel_${feel}`)}`
        : t(`melody_instrument_${instrument}`)
      : null,
    click ? t('melody_click') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: 10,
      padding: 14,
    },
    playRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
    play: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 28,
      height: 56,
      justifyContent: 'center',
      width: 56,
    },
    grow: { flexGrow: 1, flexShrink: 1 },
    title: { color: colors.text, fontSize: 16, fontWeight: '700' },
    small: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
    iconButton: {
      alignItems: 'center',
      height: TOUCH,
      justifyContent: 'center',
      minWidth: TOUCH,
    },
    bar: { backgroundColor: colors.border, borderRadius: 3, height: 6, overflow: 'hidden' },
    barFill: { backgroundColor: colors.primary, height: 6 },
    now: { color: colors.primary, fontSize: 18, fontStyle: 'italic', lineHeight: 24 },
    error: { color: colors.error, fontSize: 13, lineHeight: 18 },
    group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    heading: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
      marginBottom: 6,
      marginTop: 20,
    },
    chip: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    on: { backgroundColor: colors.primary, borderColor: colors.primary },
    label: { color: colors.textSecondary, fontSize: 12, marginBottom: 4, marginTop: 4 },
    part: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: 'row',
      marginBottom: 6,
      minHeight: TOUCH + 8,
    },
    partTarget: { borderColor: colors.primary, borderWidth: 2 },
    partMain: {
      alignItems: 'center',
      flexDirection: 'row',
      flexGrow: 1,
      flexShrink: 1,
      gap: 10,
      padding: 10,
    },
    input: {
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      fontSize: 14,
      minHeight: 120,
    },
    actions: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 10 },
    outline: {
      alignItems: 'center',
      borderColor: colors.primary,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 6,
      minHeight: TOUCH,
      paddingHorizontal: 14,
    },
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

  const partDetail = (row: (typeof view.rows)[number]) => {
    if (row.alignment === 'none') return t('melody_part_none');
    const notes = row.melody?.syllables ?? 0;
    const text = t(`melody_part_${row.alignment}`, {
      notes,
      syllables: row.syllables,
      difference: Math.abs(notes - row.syllables),
    });
    return row.inheritedFrom
      ? `${text} · ${t('melody_part_inherited', { from: row.inheritedFrom })}`
      : text;
  };

  return (
    <View testID="melody-panel">
      <View style={styles.card}>
        <View style={styles.playRow}>
          <TouchableOpacity
            testID="melody-play"
            accessibilityRole="button"
            accessibilityLabel={t(phase === 'idle' ? 'melody_play' : 'melody_stop')}
            style={styles.play}
            onPress={() => (phase === 'idle' ? onPlay({ kind: 'song' }, voice) : onStop())}
          >
            {busy ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Ionicons
                name={phase === 'idle' ? 'play' : 'stop'}
                size={26}
                color={colors.onPrimary}
              />
            )}
          </TouchableOpacity>
          <View style={styles.grow}>
            <Text style={styles.title}>
              {busy
                ? t('melody_preparing', { percent: Math.round(progress * 100) })
                : t(phase === 'playing' ? 'melody_playing' : 'melody_hear')}
            </Text>
            <Text style={styles.small} testID="melody-summary">
              {summary}
            </Text>
            {view.total.seconds > 0 ? (
              <Text style={styles.small} testID="melody-length">
                {t(view.total.exact ? 'melody_length' : 'melody_length_estimated', {
                  time: formatDuration(view.total.seconds),
                })}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            testID="melody-options-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: optionsOpen }}
            accessibilityLabel={t('melody_options')}
            style={styles.iconButton}
            onPress={() => setOptionsOpen((open) => !open)}
          >
            <Ionicons
              name={optionsOpen ? 'options' : 'options-outline'}
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {busy ? (
          <View style={styles.bar}>
            <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
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

        {optionsOpen ? (
          <View testID="melody-options">
            <Text style={styles.label}>{t('melody_voice')}</Text>
            <View style={styles.group}>
              {TIMBRES.map((option) =>
                chip(`melody-voice-${option}`, t(`melody_voice_${option}`), timbre === option, () =>
                  setTimbre(option),
                ),
              )}
              {chip('melody-click', t('melody_click'), click, () => setClick((on) => !on))}
            </View>
            <Text style={styles.label}>{t('melody_accompaniment')}</Text>
            <View style={styles.group}>
              {chip(
                'melody-instrument-none',
                t('melody_instrument_none'),
                instrument === null,
                () => setInstrument(null),
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
              <>
                <Text style={styles.label}>{t('melody_feel')}</Text>
                <View style={styles.group}>
                  {(['auto', ...FEELS] as const).map((option) =>
                    chip(`melody-feel-${option}`, t(`melody_feel_${option}`), feel === option, () =>
                      setFeel(option),
                    ),
                  )}
                </View>
              </>
            ) : null}
            <Text style={[styles.small, { marginTop: 8 }]}>{t('melody_backing_hint')}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.heading}>{t('melody_parts')}</Text>
      {view.rows.length === 0 ? (
        <Text style={styles.small} testID="melody-parts-empty">
          {t('melody_parts_empty')}
        </Text>
      ) : (
        <View testID="melody-status">
          {view.rows.map((row) => {
            const off = row.alignment === 'short' || row.alignment === 'long';
            const chosen = editable && row.label !== null && row.label === writingInto;
            const name = row.label ?? t('melody_scope_unnamed', { number: row.sectionIndex + 1 });
            return (
              <View key={row.sectionIndex} style={[styles.part, chosen && styles.partTarget]}>
                <TouchableOpacity
                  testID={`melody-part-${row.sectionIndex}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: chosen }}
                  disabled={!editable || row.label === null}
                  style={styles.partMain}
                  onPress={() => row.label && setTarget(row.label)}
                >
                  <Ionicons
                    name={
                      row.alignment === 'match'
                        ? 'checkmark-circle'
                        : off
                          ? 'alert-circle'
                          : 'ellipse-outline'
                    }
                    size={22}
                    color={
                      row.alignment === 'match'
                        ? colors.primary
                        : off
                          ? colors.error
                          : colors.textSecondary
                    }
                  />
                  <View style={styles.grow}>
                    <Text style={styles.title}>{name}</Text>
                    <Text style={[styles.small, off && { color: colors.error }]}>
                      {partDetail(row)}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`melody-part-play-${row.sectionIndex}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('melody_part_play', { label: name })}
                  style={styles.iconButton}
                  onPress={() => onPlay({ kind: 'section', index: row.sectionIndex }, voice)}
                >
                  <Ionicons name="play-circle-outline" size={28} color={colors.primary} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {editable ? (
        <>
          <Text style={styles.heading}>
            {writingInto
              ? t('melody_write_into', { label: writingInto })
              : t('melody_write_default')}
          </Text>
          <Text style={styles.label}>{t('melody_length_label')}</Text>
          <View style={styles.group}>
            {LENGTHS.map((option) =>
              chip(`melody-length-${option.beats}`, option.label, length === option.beats, () =>
                setLength(option.beats),
              ),
            )}
          </View>
          <Text style={styles.label}>{t('melody_range')}</Text>
          <View style={styles.group}>
            {BASE_PITCHES.map((pitch) =>
              chip(
                `melody-octave-${pitch}`,
                `C${Math.floor(pitch / 12) - 1}–C${Math.floor(pitch / 12) + 1}`,
                base === pitch,
                () => setBase(pitch),
              ),
            )}
          </View>
          <PianoKeys firstPitch={base} onKey={press} />
          <View style={styles.actions}>
            <TouchableOpacity
              testID="melody-rest"
              accessibilityRole="button"
              style={styles.outline}
              onPress={() => press(null)}
            >
              <Ionicons name="pause-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary }}>{t('melody_rest')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="melody-backspace"
              accessibilityRole="button"
              accessibilityLabel={t('melody_backspace')}
              style={styles.outline}
              onPress={() => onChange(removeLastNote(melody, writingInto))}
            >
              <Ionicons name="backspace-outline" size={18} color={colors.primary} />
              <Text style={{ color: colors.primary }}>{t('melody_backspace_short')}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}

      {view.errors.length > 0 ? (
        <Text style={[styles.error, { marginTop: 10 }]} testID="melody-errors">
          {t('melody_errors', {
            count: view.errors.length,
            line: view.errors[0].line,
            token: view.errors[0].token,
          })}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="melody-notation-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: notationOpen }}
        style={[styles.actions, { minHeight: TOUCH }]}
        onPress={() => setNotationOpen((open) => !open)}
      >
        <Ionicons
          name={notationOpen ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={colors.text}
        />
        <Text style={styles.title}>{t('melody_text')}</Text>
      </TouchableOpacity>
      {notationOpen ? (
        <>
          <Text style={styles.small}>{t('melody_text_hint')}</Text>
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
          <Text style={[styles.small, tooLong && { color: colors.error }]}>
            {t('song_lyrics_count', { count: melody.length, max: MAX_SONG_MELODY_LENGTH })}
          </Text>
        </>
      ) : null}

      <Text style={styles.heading}>{t('melody_export')}</Text>
      <View style={styles.actions}>
        <TouchableOpacity
          testID="melody-export-midi"
          accessibilityRole="button"
          style={styles.outline}
          onPress={() => onExport('midi')}
        >
          <Ionicons name="share-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary }}>{t('melody_export_midi')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="melody-export-abc"
          accessibilityRole="button"
          style={styles.outline}
          onPress={() => onExport('abc')}
        >
          <Ionicons name="share-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary }}>{t('melody_export_abc')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default MelodyPanel;
