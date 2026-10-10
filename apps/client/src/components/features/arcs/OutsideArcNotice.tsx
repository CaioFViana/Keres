import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/theme';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

interface OutsideArcNoticeProps {
  /** How many results the search found outside the arc being looked at. */
  count: number;
  /** Whether those results are being shown too. */
  expanded: boolean;
  onToggle: () => void;
}

/** Under a search: what it found in other arcs, one tap to see it, one tap to go back. */
const OutsideArcNotice: React.FC<OutsideArcNoticeProps> = ({ count, expanded, onToggle }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (count === 0) return null;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      testID="outside-arc-notice"
      onPress={onToggle}
      style={[styles.row, { borderColor: colors.border }]}
    >
      <ThemedText tone="primary">
        {expanded ? t('search_outside_arc_hide', { count }) : t('search_outside_arc', { count })}
      </ThemedText>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: { borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10 },
});

export default OutsideArcNotice;
