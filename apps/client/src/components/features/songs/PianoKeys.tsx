import { pitchLabel } from '@keres/shared';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface PianoKeysProps {
  /** MIDI pitch of the first key; it should be a C. */
  firstPitch: number;
  /** Octaves drawn, from `firstPitch`. */
  octaves?: number;
  disabled?: boolean;
  onKey: (pitch: number) => void;
}

const WHITE = [0, 2, 4, 5, 7, 9, 11] as const;
/** Each black key and the white key it sits to the right of. */
const BLACK: Record<number, number> = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
const KEY_WIDTH = 42;
const BLACK_WIDTH = 28;

/**
 * A keyboard to slide across: one or two octaves of keys that sound the note and write it. A plain
 * row of touchable shapes - the sound and the writing are the screen's, so this draws nothing it
 * has to remember.
 */
const PianoKeys: React.FC<PianoKeysProps> = ({
  firstPitch,
  octaves = 2,
  disabled = false,
  onKey,
}) => {
  const { colors } = useTheme();
  const whites = Array.from({ length: octaves * 7 + 1 }, (_, index) => {
    const octave = Math.floor(index / 7);
    return firstPitch + octave * 12 + WHITE[index % 7];
  });
  const blacks = Array.from({ length: octaves * 12 }, (_, offset) => offset)
    .filter((offset) => offset % 12 in BLACK)
    .map((offset) => ({
      pitch: firstPitch + offset,
      left: (Math.floor(offset / 12) * 7 + BLACK[offset % 12] + 1) * KEY_WIDTH - BLACK_WIDTH / 2,
    }));

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator testID="piano-keys">
      <View style={[styles.keys, { width: whites.length * KEY_WIDTH }]}>
        {whites.map((pitch) => (
          <TouchableOpacity
            key={pitch}
            testID={`piano-key-${pitch}`}
            accessibilityRole="button"
            accessibilityLabel={pitchLabel(pitch)}
            disabled={disabled}
            style={[
              styles.white,
              { backgroundColor: colors.surface, borderColor: colors.border },
              disabled && styles.disabled,
            ]}
            onPress={() => onKey(pitch)}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 10 }}>
              {pitch % 12 === 0 ? pitchLabel(pitch) : ''}
            </Text>
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
              { left, backgroundColor: colors.text },
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
  keys: { flexDirection: 'row', height: 112 },
  white: {
    alignItems: 'center',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    height: 112,
    justifyContent: 'flex-end',
    paddingBottom: 4,
    width: KEY_WIDTH,
  },
  black: {
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    height: 68,
    position: 'absolute',
    top: 0,
    width: BLACK_WIDTH,
  },
  disabled: { opacity: 0.4 },
});

export default PianoKeys;
