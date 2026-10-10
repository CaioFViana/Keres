import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import MapIcon from '@/src/components/common/display/MapIcon/MapIcon';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { StoryArcSelect } from '@/src/db/schema';
import { type ThemeColors, useTheme } from '@/src/theme';
import { layout } from '@/src/theme/layout';
import { fontSize, fontWeight, space } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';

interface Props {
  visible: boolean;
  arcs: StoryArcSelect[];
  activeArcId: string | null;
  onSelect: (arcId: string | null) => void;
  onClose: () => void;
}

const ArcPickerModal: React.FC<Props> = ({ visible, arcs, activeArcId, onSelect, onClose }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const vocab = useStoryVocabulary();
  const styles = useThemedStyles(createStyles);

  const choose = (arcId: string | null) => {
    onSelect(arcId);
    onClose();
  };

  return (
    <ResponsiveModal visible={visible} onClose={onClose} inset="compact" tone="raised">
      <ModalHeader title={t('arc_picker_title', { arcs: vocab.term('Arc', true) })} />
      <ScrollView style={layout.fill} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={styles.row}
          onPress={() => choose(null)}
          accessibilityRole="button"
          testID="arc-picker-row-all"
        >
          <MapIcon name="library" size={22} color={colors.primary} testID="arc-picker-icon-all" />
          <Text style={styles.label}>{t('all_arcs', { arcs: vocab.term('Arc', true) })}</Text>
          {!activeArcId && (
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={colors.primary}
              testID="arc-picker-check-all"
            />
          )}
        </TouchableOpacity>
        {arcs.map((arc) => {
          const color = arc.color || colors.primary;
          const selected = activeArcId === arc.id;
          return (
            <TouchableOpacity
              key={arc.id}
              style={styles.row}
              onPress={() => choose(arc.id)}
              accessibilityRole="button"
              testID={`arc-picker-row-${arc.id}`}
            >
              <MapIcon
                name={arc.icon || 'library'}
                size={22}
                color={color}
                testID={`arc-picker-icon-${arc.id}`}
              />
              <Text style={styles.label}>{arc.title}</Text>
              {selected && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={colors.primary}
                  testID={`arc-picker-check-${arc.id}`}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ResponsiveModal>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { ...layout.row, gap: space.lg, paddingVertical: space.md },
    label: {
      ...layout.fill,
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
  });

export default ArcPickerModal;
