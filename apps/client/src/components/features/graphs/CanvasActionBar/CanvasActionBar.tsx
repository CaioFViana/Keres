import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../../../theme';

type Glyph = keyof typeof Ionicons.glyphMap;

const ACTION_BUTTON_PADDING_VERTICAL = 8;
const ACTION_GLYPH_SIZE = 22;
/**
 * One action row height (button padding around the glyph). Rows that swap with
 * the action bar, like the draw bar's compact hint line, match it so the canvas
 * below never pops.
 */
export const CANVAS_ACTION_ROW_HEIGHT = ACTION_BUTTON_PADDING_VERTICAL * 2 + ACTION_GLYPH_SIZE;

interface CanvasActionBarButtonProps {
  icon: Glyph;
  /** Accessibility label - the buttons show no text. */
  label: string;
  onPress: () => void;
  testID?: string;
  /** Mode toggles tint primary while their mode is on. */
  active?: boolean;
  /** Disabled actions dim and stop firing. */
  disabled?: boolean;
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
  active = false,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        button: {
          paddingHorizontal: 14,
          paddingVertical: ACTION_BUTTON_PADDING_VERTICAL,
          borderRadius: 8,
        },
      }),
    [],
  );
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || undefined }}
      onPress={onPress}
      disabled={disabled}
      style={styles.button}
    >
      <Ionicons
        name={icon}
        size={ACTION_GLYPH_SIZE}
        color={disabled ? colors.textSecondary : active ? colors.primary : colors.text}
      />
    </TouchableOpacity>
  );
};

/**
 * The icon row above a board or location map: add actions that used to be full pill
 * frames, now compact glyphs. Pickers keep their exact modal through the pill's
 * `trigger`; direct actions just fire.
 */
export const CanvasActionBar: React.FC<{
  children: React.ReactNode;
  testID?: string;
  /** Tour anchor ref; anchored rows opt out of Android view flattening. */
  anchorRef?: (node: unknown) => void;
}> = ({ children, testID, anchorRef }) => {
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
      }),
    [],
  );
  return (
    <View
      style={styles.row}
      testID={testID}
      ref={anchorRef}
      collapsable={anchorRef ? false : undefined}
    >
      {children}
    </View>
  );
};
