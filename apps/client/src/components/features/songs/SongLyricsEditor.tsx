import { Ionicons } from '@expo/vector-icons';
import {
  duplicateSectionLabels,
  insertBlockAt,
  MAX_SONG_LYRICS_LENGTH,
  nextSectionLabel,
  numberDuplicateSections,
  type SectionWords,
  sectionBlock,
  type SyllableLanguage,
} from '@keres/shared';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { type ThemeColors, useTheme } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { typography } from '@/src/theme/tokens';
import LeadSheetView from './LeadSheetView';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

interface SongLyricsEditorProps {
  value: string;
  onChange: (lyrics: string) => void;
  /** Moves every chord (and the key) by this many semitones; the screen owns the song's other facts. */
  onTranspose: (semitones: number) => void;
  /** Whether a transposition can be taken back, and the way to do it. */
  canUndoTranspose?: boolean;
  onUndoTranspose?: () => void;
  editable: boolean;
  words: SectionWords;
  /** The words that name a section when it is added; the text keeps the label that was written. */
  newSectionWords?: SectionWords;
  syllableLanguage: SyllableLanguage;
  /** The music tools are on: the sheet, transposing and the chord hint. Off, the words are all there is. */
  musicTools?: boolean;
  /** The line being sung while the tune plays, to follow on the sheet. */
  activeLine?: { sectionIndex: number; sourceIndex: number } | null;
}

type Mode = 'write' | 'sheet';

const SECTION_KINDS = ['verse', 'chorus', 'bridge'] as const;

/**
 * Where the lyrics are written, as ChordPro text, and read back as a lead sheet. Writing is a plain
 * field with a bar of helpers (a section in one touch, the chords moved up or down); the sheet is
 * drawn only when asked for, and shows the syllables of each line when that is switched on.
 */
const SongLyricsEditor: React.FC<SongLyricsEditorProps> = ({
  value,
  onChange,
  onTranspose,
  canUndoTranspose = false,
  onUndoTranspose,
  editable,
  words,
  newSectionWords = words,
  syllableLanguage,
  musicTools = true,
  activeLine = null,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [chosenMode, setMode] = useState<Mode>('write');
  // Without the music tools there is no sheet to switch to: the words are written in one place.
  const mode: Mode = musicTools ? chosenMode : 'write';
  const [showSyllables, setShowSyllables] = useState(false);
  const selection = useRef({ start: value.length, end: value.length });
  // A cursor placed by the app (after a section is added) is held only until the person moves it.
  const [placed, setPlaced] = useState<{ start: number; end: number } | undefined>(undefined);
  // Only the labels of a text being looked at are worth working out; the field itself reads nothing.
  const duplicates = useMemo(() => duplicateSectionLabels(value, words), [value, words]);

  const addSection = (kind: (typeof SECTION_KINDS)[number]) => {
    const label = nextSectionLabel(kind, value, newSectionWords);
    // A heading anyone can read, unless the person works with ChordPro: then the directive block it is.
    const block = musicTools ? sectionBlock(kind, label) : `[${label}]\n`;
    const at = selection.current.start;
    const next = insertBlockAt(value, at, block);
    onChange(next);
    // Inside the new section, on its empty line, ready to write.
    const inside = next.indexOf(block) + block.indexOf('\n') + 1;
    selection.current = { start: inside, end: inside };
    setPlaced({ start: inside, end: inside });
  };

  const overLimit = value.length > MAX_SONG_LYRICS_LENGTH * 0.9;
  const styles = useThemedStyles(createStyles, [overLimit]);

  return (
    <View>
      {musicTools ? (
        <View style={styles.bar}>
          {(['write', 'sheet'] as const).map((option) => (
            <TouchableOpacity
              key={option}
              testID={`song-mode-${option}`}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === option }}
              style={[styles.button, mode === option && styles.active]}
              onPress={() => setMode(option)}
            >
              <Text style={{ color: mode === option ? colors.onPrimary : colors.text }}>
                {t(`song_mode_${option}`)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {mode === 'write' ? (
        <>
          {editable ? (
            <View style={styles.bar}>
              {SECTION_KINDS.map((kind) => (
                <TouchableOpacity
                  key={kind}
                  testID={`song-add-${kind}`}
                  accessibilityRole="button"
                  style={styles.button}
                  onPress={() => addSection(kind)}
                >
                  <Ionicons name="add" size={14} color={colors.text} />
                  <ThemedText>{t(`song_add_${kind}`)}</ThemedText>
                </TouchableOpacity>
              ))}
              {(musicTools ? ([-1, 1] as const) : []).map((step) => (
                <TouchableOpacity
                  key={step}
                  testID={`song-transpose-${step > 0 ? 'up' : 'down'}`}
                  accessibilityRole="button"
                  accessibilityLabel={t(step > 0 ? 'song_transpose_up' : 'song_transpose_down')}
                  style={styles.button}
                  onPress={() => onTranspose(step)}
                >
                  <Ionicons
                    name={step > 0 ? 'arrow-up-outline' : 'arrow-down-outline'}
                    size={14}
                    color={colors.text}
                  />
                  <ThemedText>{t('song_transpose')}</ThemedText>
                </TouchableOpacity>
              ))}
              {musicTools && canUndoTranspose ? (
                <TouchableOpacity
                  testID="song-transpose-undo"
                  accessibilityRole="button"
                  style={styles.button}
                  onPress={onUndoTranspose}
                >
                  <Ionicons name="arrow-undo-outline" size={14} color={colors.text} />
                  <ThemedText>{t('song_transpose_undo')}</ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {duplicates.length > 0 ? (
            <View style={styles.warning} testID="song-duplicates">
              <ThemedText tone="error">
                {t('song_duplicate_sections', { labels: duplicates.join(', ') })}
              </ThemedText>
              {editable ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  testID="song-number-duplicates"
                  onPress={() => onChange(numberDuplicateSections(value, words))}
                >
                  <ThemedText tone="primary" style={{ marginTop: 4 }}>
                    {t('song_number_duplicates')}
                  </ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          <TextInput
            testID="song-lyrics"
            accessibilityLabel={t('song_lyrics')}
            value={value}
            editable={editable}
            multiline
            maxLength={MAX_SONG_LYRICS_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t(
              musicTools ? 'song_lyrics_placeholder' : 'song_lyrics_placeholder_simple',
            )}
            style={styles.input}
            onChangeText={onChange}
            selection={placed}
            onSelectionChange={(event) => {
              selection.current = event.nativeEvent.selection;
              if (placed) setPlaced(undefined);
            }}
          />
          <Text style={styles.count}>
            {t('song_lyrics_count', { count: value.length, max: MAX_SONG_LYRICS_LENGTH })}
          </Text>
        </>
      ) : (
        <>
          <TouchableOpacity
            testID="song-toggle-syllables"
            accessibilityRole="button"
            accessibilityState={{ selected: showSyllables }}
            style={[styles.button, showSyllables && styles.active, { alignSelf: 'flex-start' }]}
            onPress={() => setShowSyllables((current) => !current)}
          >
            <Text style={{ color: showSyllables ? colors.onPrimary : colors.text }}>
              {t('song_show_syllables')}
            </Text>
          </TouchableOpacity>
          {showSyllables ? (
            <ThemedText tone="secondary" style={{ fontSize: 12, marginTop: 4 }}>
              {t('song_syllables_estimate')}
            </ThemedText>
          ) : null}
          <LeadSheetView
            lyrics={value}
            words={words}
            syllableLanguage={showSyllables ? syllableLanguage : undefined}
            activeLine={activeLine}
          />
        </>
      )}
    </View>
  );
};

const createStyles = (colors: ThemeColors, [overLimit]: [boolean]) =>
  StyleSheet.create({
    bar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    button: {
      alignItems: 'center',
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    active: { backgroundColor: colors.primary, borderColor: colors.primary },
    input: {
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      fontSize: 14,
      minHeight: 220,
    },
    warning: {
      borderColor: colors.error,
      borderRadius: 8,
      borderWidth: 1,
      marginBottom: 8,
      padding: 8,
    },
    count: {
      ...typography.caption,
      color: overLimit ? colors.error : colors.textSecondary,
      marginTop: 4,
    },
  });

export default SongLyricsEditor;
