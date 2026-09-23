import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

type Glyph = keyof typeof Ionicons.glyphMap;

interface CanvasActionBarButtonProps {
  icon: Glyph;
  /** Accessibility label - the buttons show no text. */
  label: string;
  onPress: () => void;
  testID?: string;
}

/**
 * One icon button of the canvas action bar. Manuscript-toolbar dumb: the caller owns
 * everything, the button only shows the glyph and fires.
 */
export const CanvasActionBarButton: React.FC<CanvasActionBarButtonProps> = ({
  icon,
  label,
  onPress,
  testID,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
      }),
    [],
  );
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.button}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </TouchableOpacity>
  );
};

/**
 * The icon row above a board or location map: add actions that used to be full pill
 * frames, now compact glyphs. Pickers keep their exact modal through the pill's
 * `trigger`; direct actions just fire.
 */
export const CanvasActionBar: React.FC<{ children: React.ReactNode; testID?: string }> = ({
  children,
  testID,
}) => {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
      }),
    [],
  );
  return (
    <View style={styles.row} testID={testID}>
      {children}
    </View>
  );
};
