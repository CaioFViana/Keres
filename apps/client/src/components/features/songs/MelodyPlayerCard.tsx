import { Ionicons } from '@expo/vector-icons';
import {
  FEELS,
  type Feel,
  formatDuration,
  INSTRUMENTS,
  type Instrument,
  type VoiceTimbre,
} from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type {
  ActiveLine,
  PlaybackPhase,
  PlaybackProblem,
  PlaybackVoice,
} from '@/src/hooks/useSongPlayback';
import { useTheme } from '@/src/theme';
import SongChip from './SongChip';

export const TIMBRES: readonly VoiceTimbre[] = ['hum', 'ah', 'la'];
/** The least a thing to touch should be, in points. */
export const TOUCH = 44;

/** The sound the person asked for, kept by the panel because the parts and the files use it too. */
export function useMelodyVoice() {
  const [timbre, setTimbre] = useState<VoiceTimbre>('hum');
  const [click, setClick] = useState(false);
  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [feel, setFeel] = useState<Feel | 'auto'>('auto');
  const voice: PlaybackVoice = { timbre, click, instrument, feel };
  return { voice, setTimbre, setClick, setInstrument, setFeel };
}

interface MelodyPlayerCardProps {
  state: ReturnType<typeof useMelodyVoice>;
  phase: PlaybackPhase;
  progress: number;
  problem: PlaybackProblem | null;
  active: ActiveLine | null;
  /** The length of the whole song, if it can be said, and whether it was measured or guessed. */
  total: { seconds: number; exact: boolean };
  onPlay: () => void;
  onStop: () => void;
}

/**
 * Hearing the song: one big button, a line saying with what it will sound, the line being sung while
 * it does, and - behind a button of its own - the voice, the click and the accompaniment to choose.
 */
const MelodyPlayerCard: React.FC<MelodyPlayerCardProps> = ({
  state,
  phase,
  progress,
  problem,
  active,
  total,
  onPlay,
  onStop,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [optionsOpen, setOptionsOpen] = useState(false);
  const { voice, setTimbre, setClick, setInstrument, setFeel } = state;
  const busy = phase === 'preparing';

  const summary = [
    t(`melody_voice_${voice.timbre}`),
    voice.instrument
      ? voice.feel !== 'auto' && voice.instrument !== 'violin'
        ? `${t(`melody_instrument_${voice.instrument}`)}, ${t(`melody_feel_${voice.feel}`)}`
        : t(`melody_instrument_${voice.instrument}`)
      : null,
    voice.click ? t('melody_click') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <TouchableOpacity
          testID="melody-play"
          accessibilityRole="button"
          accessibilityLabel={t(phase === 'idle' ? 'melody_play' : 'melody_stop')}
          style={[styles.play, { backgroundColor: colors.primary }]}
          onPress={phase === 'idle' ? onPlay : onStop}
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
          <Text style={[styles.title, { color: colors.text }]}>
            {busy
              ? t('melody_preparing', { percent: Math.round(progress * 100) })
              : t(phase === 'playing' ? 'melody_playing' : 'melody_hear')}
          </Text>
          <Text style={[styles.small, { color: colors.textSecondary }]} testID="melody-summary">
            {summary}
          </Text>
          {total.seconds > 0 ? (
            <Text style={[styles.small, { color: colors.textSecondary }]} testID="melody-length">
              {t(total.exact ? 'melody_length' : 'melody_length_estimated', {
                time: formatDuration(total.seconds),
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
        <View style={[styles.bar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.barFill,
              { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>
      ) : null}
      {active ? (
        <Text style={[styles.now, { color: colors.primary }]} testID="melody-now">
          {`♪ ${active.text}`}
        </Text>
      ) : null}
      {problem ? (
        <Text style={[styles.small, { color: colors.error }]} testID="melody-problem">
          {t(problem === 'no-tune' ? 'melody_no_tune' : 'melody_play_failed')}
        </Text>
      ) : null}

      {optionsOpen ? (
        <View testID="melody-options">
          <Text style={[styles.label, { color: colors.textSecondary }]}>{t('melody_voice')}</Text>
          <View style={styles.group}>
            {TIMBRES.map((option) => (
              <SongChip
                key={option}
                testID={`melody-voice-${option}`}
                label={t(`melody_voice_${option}`)}
                selected={voice.timbre === option}
                onPress={() => setTimbre(option)}
              />
            ))}
            <SongChip
              testID="melody-click"
              label={t('melody_click')}
              selected={voice.click}
              onPress={() => setClick(!voice.click)}
            />
          </View>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            {t('melody_accompaniment')}
          </Text>
          <View style={styles.group}>
            <SongChip
              testID="melody-instrument-none"
              label={t('melody_instrument_none')}
              selected={voice.instrument === null}
              onPress={() => setInstrument(null)}
            />
            {INSTRUMENTS.map((option) => (
              <SongChip
                key={option}
                testID={`melody-instrument-${option}`}
                label={t(`melody_instrument_${option}`)}
                selected={voice.instrument === option}
                onPress={() => setInstrument(option)}
              />
            ))}
          </View>
          {voice.instrument && voice.instrument !== 'violin' ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                {t('melody_feel')}
              </Text>
              <View style={styles.group}>
                {(['auto', ...FEELS] as const).map((option) => (
                  <SongChip
                    key={option}
                    testID={`melody-feel-${option}`}
                    label={t(`melody_feel_${option}`)}
                    selected={voice.feel === option}
                    onPress={() => setFeel(option)}
                  />
                ))}
              </View>
            </>
          ) : null}
          <Text style={[styles.small, { color: colors.textSecondary, marginTop: 8 }]}>
            {t('melody_backing_hint')}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, gap: 10, padding: 14 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  play: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  grow: { flexGrow: 1, flexShrink: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, marginBottom: 4, marginTop: 4 },
  iconButton: { alignItems: 'center', height: TOUCH, justifyContent: 'center', minWidth: TOUCH },
  bar: { borderRadius: 3, height: 6, overflow: 'hidden' },
  barFill: { height: 6 },
  now: { fontSize: 18, fontStyle: 'italic', lineHeight: 24 },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

export default MelodyPlayerCard;
