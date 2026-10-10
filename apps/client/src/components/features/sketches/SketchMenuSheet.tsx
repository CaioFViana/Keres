import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { type ThemeColors, useTheme } from '../../../theme';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import { typography } from '../../../theme/tokens';

export interface SketchMenuItem {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected?: boolean;
  onPress: () => void;
}

interface SketchMenuSheetProps {
  title: string;
  items: readonly SketchMenuItem[];
  onClose: () => void;
}

/**
 * A short list of choices in a bottom sheet: the tool groups and the overflow actions of the
 * compact sketch toolbar. Picking an item runs it and closes the sheet.
 */
const SketchMenuSheet: React.FC<SketchMenuSheetProps> = ({ title, items, onClose }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <ResponsiveModal
      visible
      onClose={onClose}
      placement="bottom"
      keyboardAvoiding={false}
      tone="raised"
      inset="sheet"
    >
      <ModalHeader title={title} onClose={onClose} />
      {items.map((item) => (
        <TouchableOpacity
          key={item.id}
          testID={`sketch-menu-${item.id}`}
          accessibilityRole="button"
          accessibilityState={{ selected: !!item.selected }}
          accessibilityLabel={item.label}
          onPress={() => {
            item.onPress();
            onClose();
          }}
          style={styles.row}
        >
          <Ionicons
            name={item.icon}
            size={24}
            color={item.selected ? colors.primary : colors.text}
          />
          <Text style={[styles.label, item.selected && styles.labelSelected]}>{item.label}</Text>
          {item.selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
        </TouchableOpacity>
      ))}
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    label: { ...typography.bodyLarge, color: colors.text, flex: 1 },
    labelSelected: { fontWeight: '700', color: colors.primary },
  });

export default SketchMenuSheet;
