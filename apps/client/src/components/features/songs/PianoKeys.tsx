import { pitchLabel } from '@keres/shared';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';
import { COMPACT_KEY } from './pianoLayout';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

interface PianoKeysProps {
  /** MIDI pitch of the first key; it should be a C. */
  firstPitch: number;
  /** Octaves drawn, from `firstPitch`. */
  octaves?: number;
  /** Width of a white key; the keyboard is as wide as its keys, so the screen decides it. */
  keyWidth?: number;
  /** Height of the keys. */
  height?: number;
  disabled?: boolean;
  onKey: (pitch: number) => void;
}

const WHITE = [0, 2, 4, 5, 7, 9, 11] as const;
/** Each black key and the white key it sits to the right of. */
const BLACK: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };

/**
 * A keyboard to play on: octaves of keys that sound the note and write it. A plain row of touchable
 * shapes - the sound and the writing are the screen's, so this draws nothing it has to remember. Its
 * size is given (see `pianoLayout`): on a wide screen the keys fill the width, on a narrow one the row
 * is wider than the screen and slides.
 */
const PianoKeys: React.FC<PianoKeysProps> = ({
  firstPitch,
  octaves = 2,
  keyWidth = COMPACT_KEY,
  height = 112,
  disabled = false,
  onKey,
}) => {
  const { colors } = useTheme();
  const blackWidth = keyWidth * 0.66;
  const blackHeight = height * 0.6;
  const whites = Array.from({ length: octaves * 7 + 1 }, (_, index) => {
    const octave = Math.floor(index / 7);
    return firstPitch + octave * 12 + WHITE[index % 7];
  });
  const blacks = Array.from({ length: octaves * 12 }, (_, offset) => offset)
    .filter((offset) => offset % 12 in BLACK)
    .map((offset) => ({
      pitch: firstPitch + offset,
      left: (Math.floor(offset / 12) * 7 + BLACK[offset % 12] + 1) * keyWidth - blackWidth / 2,
    }));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator testID="piano-keys">
      <View style={[styles.keys, { height, width: whites.length * keyWidth }]}>
        {whites.map((pitch) => (
          <TouchableOpacity
            key={pitch}
            testID={`piano-key-${pitch}`}
            accessibilityRole="button"
            accessibilityLabel={pitchLabel(pitch)}
            disabled={disabled}
            style={[
              styles.white,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                height,
                width: keyWidth,
              },
              disabled && styles.disabled,
            ]}
            onPress={() => onKey(pitch)}
          >
            <ThemedText tone="secondary" style={{ fontSize: 10 }}>
              {pitch % 12 === 0 ? pitchLabel(pitch) : ''}
            </ThemedText>
          </TouchableOpacity>
        ))}
        {blacks.map(({ pitch, left }) => (
          <TouchableOpacity
            key={pitch}
            testID={`piano-key-${pitch}`}
            accessibilityRole="button"
            accessibilityLabel={pitchLabel(pitch)}
            disabled={disabled}
            style={[
              styles.black,
              { left, backgroundColor: colors.text, height: blackHeight, width: blackWidth },
              disabled && styles.disabled,
            ]}
            onPress={() => onKey(pitch)}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  keys: { flexDirection: 'row' },
  white: {
    alignItems: 'center',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  black: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    position: 'absolute',
    top: 0,
  },
  disabled: { opacity: 0.4 },
});

export default PianoKeys;
