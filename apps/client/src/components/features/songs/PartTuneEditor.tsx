import { Ionicons } from '@expo/vector-icons';
import {
  appendNote,
  keyPrefersFlats,
  noteToken,
  removeLastNote,
  type ResolvedMelody,
  type VoiceTimbre,
} from '@keres/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';
import { TOUCH } from './MelodyPlayerCard';
import PianoKeys from './PianoKeys';
import SongChip from './SongChip';

/** Note lengths the keyboard offers, in quarter notes. */
const LENGTHS = [
  { beats: 0.5, label: '½' },
  { beats: 1, label: '1' },
  { beats: 1.5, label: '1½' },
  { beats: 2, label: '2' },
  { beats: 4, label: '4' },
] as const;
/** The lowest key shown, in MIDI, and how far it can be moved: from C2 to C5, an octave at a time. */
const LOWEST = 36;
const HIGHEST = 72;

interface PartTuneEditorProps {
  part: ResolvedMelody;
  melody: string;
  songKey: string | null;
  timbre: VoiceTimbre;
  onChange: (melody: string) => void;
  onTone: (pitch: number, timbre: VoiceTimbre) => void;
  onSuggest: () => void;
}

/**
 * Writing the tune of one part: either a tune suggested from its words, or notes played on a keyboard
 * that sounds each one and writes it at the length chosen. Nothing here asks which part is meant - the
 * editor opens under the part it writes into.
 */
const PartTuneEditor: React.FC<PartTuneEditorProps> = ({
  part,
  melody,
  songKey,
  timbre,
  onChange,
  onTone,
  onSuggest,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [length, setLength] = useState<number>(1);
  const [base, setBase] = useState<number>(60);
  const flats = songKey ? keyPrefersFlats(songKey) : false;
  const hasTune = !!part.melody && part.melody.notes.length > 0 && !part.inheritedFrom;

  const press = (pitch: number | null) => {
    onChange(appendNote(melody, part.label, noteToken(pitch, length, flats)));
    if (pitch !== null) onTone(pitch, timbre);
  };

  return (
    <View
      style={[styles.editor, { borderTopColor: colors.border }]}
      testID={`melody-editor-${part.sectionIndex}`}
    >
      <TouchableOpacity
        testID="melody-suggest"
        accessibilityRole="button"
        style={[styles.filled, { backgroundColor: colors.primary }]}
        onPress={onSuggest}
      >
        <Ionicons name="sparkles-outline" size={18} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontWeight: '600' }}>
          {t(hasTune ? 'melody_suggest_again' : 'melody_suggest')}
        </Text>
      </TouchableOpacity>

      <View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {t('melody_length_label')}
        </Text>
        <View style={styles.group}>
          {LENGTHS.map((option) => (
            <SongChip
              key={option.beats}
              testID={`melody-length-${option.beats}`}
              label={option.label}
              selected={length === option.beats}
              onPress={() => setLength(option.beats)}
            />
          ))}
        </View>
      </View>

      <View>
        <View style={styles.rangeRow}>
          <TouchableOpacity
            testID="melody-octave-down"
            accessibilityRole="button"
            accessibilityLabel={t('melody_octave_down')}
            accessibilityState={{ disabled: base <= LOWEST }}
            disabled={base <= LOWEST}
            style={[styles.iconButton, base <= LOWEST && styles.dim]}
            onPress={() => setBase((current) => Math.max(LOWEST, current - 12))}
          >
            <Ionicons name="chevron-back" size={22} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.small, { color: colors.textSecondary }]} testID="melody-range">
            {`C${Math.floor(base / 12) - 1} – C${Math.floor(base / 12) + 1}`}
          </Text>
          <TouchableOpacity
            testID="melody-octave-up"
            accessibilityRole="button"
            accessibilityLabel={t('melody_octave_up')}
            accessibilityState={{ disabled: base >= HIGHEST }}
            disabled={base >= HIGHEST}
            style={[styles.iconButton, base >= HIGHEST && styles.dim]}
            onPress={() => setBase((current) => Math.min(HIGHEST, current + 12))}
          >
            <Ionicons name="chevron-forward" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <View testID="melody-piano" style={styles.piano}>
          <PianoKeys firstPitch={base} onKey={press} />
        </View>
      </View>

      <View style={styles.group}>
        <TouchableOpacity
          testID="melody-rest"
          accessibilityRole="button"
          style={[styles.outline, { borderColor: colors.primary }]}
          onPress={() => press(null)}
        >
          <Ionicons name="pause-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary }}>{t('melody_rest')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="melody-backspace"
          accessibilityRole="button"
          accessibilityLabel={t('melody_backspace')}
          style={[styles.outline, { borderColor: colors.primary }]}
          onPress={() => onChange(removeLastNote(melody, part.label))}
        >
          <Ionicons name="backspace-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary }}>{t('melody_backspace_short')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  editor: { borderTopWidth: StyleSheet.hairlineWidth, gap: 14, padding: 14 },
  label: { fontSize: 12, marginBottom: 6 },
  small: { fontSize: 13, lineHeight: 18 },
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  iconButton: { alignItems: 'center', height: TOUCH, justifyContent: 'center', minWidth: TOUCH },
  dim: { opacity: 0.3 },
  piano: { marginTop: 10 },
  outline: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: TOUCH,
    paddingHorizontal: 14,
  },
  filled: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 6,
    minHeight: TOUCH,
    paddingHorizontal: 14,
  },
});

export default PartTuneEditor;
