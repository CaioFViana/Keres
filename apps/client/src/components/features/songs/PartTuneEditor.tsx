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
import { type LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';
import { TOUCH } from './MelodyPlayerCard';
import PianoKeys from './PianoKeys';
import { clampBase, defaultBase, highestBase, PIANO_LOWEST, pianoLayout } from './pianoLayout';
import SongChip from './SongChip';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

/** Note lengths the keyboard offers, in quarter notes. */
const LENGTHS = [
  { beats: 0.5, label: '½' },
  { beats: 1, label: '1' },
  { beats: 1.5, label: '1½' },
  { beats: 2, label: '2' },
  { beats: 4, label: '4' },
] as const;
/** The editor is this wide before the tools sit in one row above the keyboard instead of stacking. */
const WIDE_EDITOR = 640;
/** Room the editor keeps around its content, both sides together. */
const EDITOR_PADDING = 28;

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
  // Until a key range is chosen, the keyboard opens where its size puts middle C in the middle.
  const [base, setBase] = useState<number | null>(null);
  // The keyboard takes the room the editor has: more octaves, wider and taller keys on a big screen.
  const [width, setWidth] = useState(0);
  const layout = pianoLayout(width > 0 ? width - EDITOR_PADDING : null);
  const wide = width >= WIDE_EDITOR;
  const shownBase = clampBase(base ?? defaultBase(layout.octaves), layout.octaves);
  const canGoDown = shownBase > PIANO_LOWEST;
  const canGoUp = shownBase < highestBase(layout.octaves);
  const firstOctave = Math.floor(shownBase / 12) - 1;
  const flats = songKey ? keyPrefersFlats(songKey) : false;
  const hasTune = !!part.melody && part.melody.notes.length > 0 && !part.inheritedFrom;

  const press = (pitch: number | null) => {
    onChange(appendNote(melody, part.label, noteToken(pitch, length, flats)));
    if (pitch !== null) onTone(pitch, timbre);
  };

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const suggest = (
    <TouchableOpacity
      testID="melody-suggest"
      accessibilityRole="button"
      style={[styles.filled, { backgroundColor: colors.primary }]}
      onPress={onSuggest}
    >
      <Ionicons name="sparkles-outline" size={18} color={colors.onPrimary} />
      <ThemedText tone="onPrimary" style={{ fontWeight: '600' }}>
        {t(hasTune ? 'melody_suggest_again' : 'melody_suggest')}
      </ThemedText>
    </TouchableOpacity>
  );

  const lengths = (
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
  );

  const range = (
    <View style={styles.rangeRow}>
      <TouchableOpacity
        testID="melody-octave-down"
        accessibilityRole="button"
        accessibilityLabel={t('melody_octave_down')}
        accessibilityState={{ disabled: !canGoDown }}
        disabled={!canGoDown}
        style={[styles.iconButton, !canGoDown && styles.dim]}
        onPress={() => setBase(shownBase - 12)}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </TouchableOpacity>
      <Text style={[styles.small, { color: colors.textSecondary }]} testID="melody-range">
        {`C${firstOctave} – C${firstOctave + layout.octaves}`}
      </Text>
      <TouchableOpacity
        testID="melody-octave-up"
        accessibilityRole="button"
        accessibilityLabel={t('melody_octave_up')}
        accessibilityState={{ disabled: !canGoUp }}
        disabled={!canGoUp}
        style={[styles.iconButton, !canGoUp && styles.dim]}
        onPress={() => setBase(shownBase + 12)}
      >
        <Ionicons name="chevron-forward" size={22} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const keyboard = (
    <View testID="melody-piano" style={styles.piano}>
      <PianoKeys
        firstPitch={shownBase}
        octaves={layout.octaves}
        keyWidth={layout.keyWidth}
        height={layout.height}
        onKey={press}
      />
    </View>
  );

  const rest = (
    <TouchableOpacity
      testID="melody-rest"
      accessibilityRole="button"
      style={[styles.outline, { borderColor: colors.primary }]}
      onPress={() => press(null)}
    >
      <Ionicons name="pause-outline" size={18} color={colors.primary} />
      <ThemedText tone="primary">{t('melody_rest')}</ThemedText>
    </TouchableOpacity>
  );

  const backspace = (
    <TouchableOpacity
      testID="melody-backspace"
      accessibilityRole="button"
      accessibilityLabel={t('melody_backspace')}
      style={[styles.outline, { borderColor: colors.primary }]}
      onPress={() => onChange(removeLastNote(melody, part.label))}
    >
      <Ionicons name="backspace-outline" size={18} color={colors.primary} />
      <ThemedText tone="primary">{t('melody_backspace_short')}</ThemedText>
    </TouchableOpacity>
  );

  // Wide: the tools are one row above a keyboard that has the whole width. Narrow: one thing per line.
  if (wide) {
    return (
      <View
        style={[styles.editor, { borderTopColor: colors.border }]}
        testID={`melody-editor-${part.sectionIndex}`}
        onLayout={onLayout}
      >
        <View style={styles.toolbar}>
          {suggest}
          {lengths}
          <View style={styles.group}>
            {rest}
            {backspace}
          </View>
          <View style={styles.toolbarEnd}>{range}</View>
        </View>
        {keyboard}
      </View>
    );
  }

  return (
    <View
      style={[styles.editor, { borderTopColor: colors.border }]}
      testID={`melody-editor-${part.sectionIndex}`}
      onLayout={onLayout}
    >
      {suggest}
      {lengths}
      <View>
        {range}
        {keyboard}
      </View>
      <View style={styles.group}>
        {rest}
        {backspace}
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
  toolbar: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  toolbarEnd: { marginLeft: 'auto' },
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
