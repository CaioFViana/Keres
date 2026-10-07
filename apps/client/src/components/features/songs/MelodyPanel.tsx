import { Ionicons } from '@expo/vector-icons';
import {
  lineSyllables,
  MAX_SONG_MELODY_LENGTH,
  parseChordPro,
  parseMelody,
  replaceSection,
  resolveMelodies,
  type SectionWords,
  songSeconds,
  suggestTune,
  type SyllableLanguage,
  type VoiceTimbre,
} from '@keres/shared';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useScreenAnchor } from '@/src/guides/useGuideAnchor';
import { useDebouncedValue } from '@/src/hooks/useDebouncedValue';
import type {
  ActiveLine,
  PlaybackPhase,
  PlaybackProblem,
  PlaybackScope,
  PlaybackVoice,
} from '@/src/hooks/useSongPlayback';
import { useTheme } from '@/src/theme';
import { AppAlert } from '@/src/utils/AppAlert';
import MelodyPlayerCard, { TOUCH, useMelodyVoice } from './MelodyPlayerCard';
import PartTuneEditor from './PartTuneEditor';

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
  /** The file asked for, and the sound chosen: a MIDI file carries the accompaniment picked here. */
  onExport: (kind: 'midi' | 'abc', voice: PlaybackVoice) => void;
}

/**
 * The tune of a song, as little as it takes: one big button to hear it; the parts, each with its own
 * play button and a way to write it (a tune suggested from the words, or a keyboard); and, folded
 * away, the sound options, the notes as text and the files. Everything shown is worked out from the
 * words and the tune after a pause in typing, and the sound is made only when play is pressed -
 * opening the song costs nothing of this.
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
  const sound = useMelodyVoice();
  const playerAnchorRef = useScreenAnchor('SongTune', 'player');
  const partsAnchorRef = useScreenAnchor('SongTune', 'parts');
  const { voice } = sound;
  const [moreOpen, setMoreOpen] = useState(!editable);
  /** The part being written, by its place among the sections of the words. */
  const [editing, setEditing] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<Record<number, number>>({});

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

  const tooLong = melody.length > MAX_SONG_MELODY_LENGTH * 0.9;

  // A tune for the part from the syllables of its lines: written in one go, after asking if the part
  // already has one, because that is the writer's work.
  const suggest = (part: (typeof view.rows)[number]) => {
    const section = parseChordPro(lyrics, words).sections[part.sectionIndex];
    const counts = section ? lineSyllables(section, language) : [];
    const attempt = (attempts[part.sectionIndex] ?? 0) + 1;
    const write = () => {
      setAttempts((current) => ({ ...current, [part.sectionIndex]: attempt }));
      onChange(
        replaceSection(
          melody,
          part.label,
          suggestTune({ syllablesPerLine: counts, key: songKey, meter, attempt }),
        ),
      );
    };
    if (part.melody && part.melody.notes.length > 0 && !part.inheritedFrom) {
      AppAlert.alert(
        t('melody_suggest_confirm_title'),
        t('melody_suggest_confirm_message', { label: part.label ?? '' }),
        [
          { text: t('cancel'), style: 'cancel' },
          { text: t('melody_suggest_again'), onPress: write },
        ],
      );
      return;
    }
    write();
  };

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
      <View ref={playerAnchorRef} collapsable={false}>
        <MelodyPlayerCard
          state={sound}
          phase={phase}
          progress={progress}
          problem={problem}
          active={active}
          total={view.total}
          onPlay={() => onPlay({ kind: 'song' }, voice)}
          onStop={onStop}
        />
      </View>

      <Text style={[styles.heading, { color: colors.text }]}>{t('melody_parts')}</Text>
      {view.rows.length === 0 ? (
        <Text style={[styles.small, { color: colors.textSecondary }]} testID="melody-parts-empty">
          {t('melody_parts_empty')}
        </Text>
      ) : (
        <View testID="melody-status" ref={partsAnchorRef} collapsable={false}>
          {view.rows.map((row) => {
            const off = row.alignment === 'short' || row.alignment === 'long';
            const open = editable && row.sectionIndex === editing;
            const name = row.label ?? t('melody_scope_unnamed', { number: row.sectionIndex + 1 });
            return (
              <View
                key={row.sectionIndex}
                style={[
                  styles.part,
                  { borderColor: colors.border },
                  open && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <View style={styles.partRow}>
                  <TouchableOpacity
                    testID={`melody-part-${row.sectionIndex}`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={t('melody_edit_part', { label: name })}
                    disabled={!editable}
                    style={styles.partMain}
                    onPress={() => setEditing(open ? null : row.sectionIndex)}
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
                      <Text style={[styles.title, { color: colors.text }]}>{name}</Text>
                      <Text
                        style={[styles.small, { color: off ? colors.error : colors.textSecondary }]}
                      >
                        {partDetail(row)}
                      </Text>
                    </View>
                    {editable ? (
                      <Ionicons
                        name={open ? 'chevron-up' : 'create-outline'}
                        size={20}
                        color={colors.textSecondary}
                      />
                    ) : null}
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
                {open ? (
                  <PartTuneEditor
                    part={row}
                    melody={melody}
                    songKey={songKey}
                    timbre={voice.timbre}
                    onChange={onChange}
                    onTone={onTone}
                    onSuggest={() => suggest(row)}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {view.errors.length > 0 ? (
        <Text style={[styles.small, { color: colors.error, marginTop: 6 }]} testID="melody-errors">
          {t('melody_errors', {
            count: view.errors.length,
            line: view.errors[0].line,
            token: view.errors[0].token,
          })}
        </Text>
      ) : null}

      <TouchableOpacity
        testID="melody-more-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: moreOpen }}
        style={styles.moreToggle}
        onPress={() => setMoreOpen((open) => !open)}
      >
        <Ionicons
          name={moreOpen ? 'chevron-down' : 'chevron-forward'}
          size={18}
          color={colors.text}
        />
        <Text style={[styles.title, { color: colors.text }]}>{t('melody_more')}</Text>
      </TouchableOpacity>
      {moreOpen ? (
        <View style={styles.more}>
          <Text style={[styles.small, { color: colors.textSecondary }]}>
            {t('melody_text_hint')}
          </Text>
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
          <Text style={[styles.small, { color: tooLong ? colors.error : colors.textSecondary }]}>
            {t('song_lyrics_count', { count: melody.length, max: MAX_SONG_MELODY_LENGTH })}
          </Text>
          <View style={styles.actions}>
            {(['midi', 'abc'] as const).map((kind) => (
              <TouchableOpacity
                key={kind}
                testID={`melody-export-${kind}`}
                accessibilityRole="button"
                style={[styles.outline, { borderColor: colors.primary }]}
                onPress={() => onExport(kind, voice)}
              >
                <Ionicons name="share-outline" size={18} color={colors.primary} />
                <Text style={{ color: colors.primary }}>{t(`melody_export_${kind}`)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 15, fontWeight: '700', marginBottom: 8, marginTop: 22 },
  title: { fontSize: 16, fontWeight: '700' },
  small: { fontSize: 13, lineHeight: 18 },
  grow: { flexGrow: 1, flexShrink: 1 },
  part: { borderRadius: 12, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  partRow: { alignItems: 'center', flexDirection: 'row', minHeight: TOUCH + 12 },
  partMain: {
    alignItems: 'center',
    flexDirection: 'row',
    flexGrow: 1,
    flexShrink: 1,
    gap: 10,
    padding: 10,
  },
  iconButton: { alignItems: 'center', height: TOUCH, justifyContent: 'center', minWidth: TOUCH },
  moreToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    minHeight: TOUCH,
  },
  more: { gap: 8 },
  input: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 14,
    minHeight: 120,
  },
  actions: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outline: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: TOUCH,
    paddingHorizontal: 14,
  },
});

export default MelodyPanel;
