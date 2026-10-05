import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '../../../theme';

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
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 20,
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    title: { color: colors.text, fontSize: 19, fontWeight: 'bold', flex: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    label: { color: colors.text, fontSize: 16, flex: 1 },
    labelSelected: { fontWeight: '700', color: colors.primary },
  });
  return (
    <ResponsiveModal
      visible
      onClose={onClose}
      placement="bottom"
      keyboardAvoiding={false}
      contentStyle={styles.sheet}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
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

export default SketchMenuSheet;
