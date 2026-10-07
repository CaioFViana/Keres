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
import { useTheme } from '@/src/theme';
import LeadSheetView from './LeadSheetView';

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
  activeLine = null,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('write');
  const [showSyllables, setShowSyllables] = useState(false);
  const selection = useRef({ start: value.length, end: value.length });
  // A cursor placed by the app (after a section is added) is held only until the person moves it.
  const [placed, setPlaced] = useState<{ start: number; end: number } | undefined>(undefined);
  // Only the labels of a text being looked at are worth working out; the field itself reads nothing.
  const duplicates = useMemo(() => duplicateSectionLabels(value, words), [value, words]);

  const addSection = (kind: (typeof SECTION_KINDS)[number]) => {
    const label = nextSectionLabel(kind, value, newSectionWords);
    const block = sectionBlock(kind, label);
    const at = selection.current.start;
    const next = insertBlockAt(value, at, block);
    onChange(next);
    // Inside the new section, on its empty line, ready to write.
    const inside = next.indexOf(block) + block.indexOf('\n') + 1;
    selection.current = { start: inside, end: inside };
    setPlaced({ start: inside, end: inside });
  };

  const overLimit = value.length > MAX_SONG_LYRICS_LENGTH * 0.9;
  const styles = StyleSheet.create({
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
    count: { color: overLimit ? colors.error : colors.textSecondary, fontSize: 12, marginTop: 4 },
  });

  return (
    <View>
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
                  <Text style={{ color: colors.text }}>{t(`song_add_${kind}`)}</Text>
                </TouchableOpacity>
              ))}
              {([-1, 1] as const).map((step) => (
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
                  <Text style={{ color: colors.text }}>{t('song_transpose')}</Text>
                </TouchableOpacity>
              ))}
              {canUndoTranspose ? (
                <TouchableOpacity
                  testID="song-transpose-undo"
                  accessibilityRole="button"
                  style={styles.button}
                  onPress={onUndoTranspose}
                >
                  <Ionicons name="arrow-undo-outline" size={14} color={colors.text} />
                  <Text style={{ color: colors.text }}>{t('song_transpose_undo')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {duplicates.length > 0 ? (
            <View style={styles.warning} testID="song-duplicates">
              <Text style={{ color: colors.error }}>
                {t('song_duplicate_sections', { labels: duplicates.join(', ') })}
              </Text>
              {editable ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  testID="song-number-duplicates"
                  onPress={() => onChange(numberDuplicateSections(value, words))}
                >
                  <Text style={{ color: colors.primary, marginTop: 4 }}>
                    {t('song_number_duplicates')}
                  </Text>
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
            placeholder={t('song_lyrics_placeholder')}
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
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
              {t('song_syllables_estimate')}
            </Text>
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

export default SongLyricsEditor;
