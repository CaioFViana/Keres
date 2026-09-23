import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';

/**
 * Screen-space chip over the map canvas: how many trajectory stops fell outside this
 * map's points. The lines only ever join stops the map actually places.
 */
const TrajectoryOffMapChip: React.FC<{ count: number }> = ({ count }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (count <= 0) return null;
  return (
    <View
      testID="trajectory-off-map-chip"
      style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
      pointerEvents="none"
    >
      <Ionicons name="footsteps" size={14} color={colors.textSecondary} />
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {t(count === 1 ? 'trajectory_off_map_one' : 'trajectory_off_map_other', { count })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  text: { fontSize: 12, fontWeight: '600' },
});

export default TrajectoryOffMapChip;
