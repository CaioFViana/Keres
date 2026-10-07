import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/theme';

interface SongChipProps {
  testID: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

/** A choice among a few, drawn as a pill that fills when it is the one chosen. */
const SongChip: React.FC<SongChipProps> = ({
  testID,
  label,
  selected,
  onPress,
  disabled = false,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      style={[
        styles.chip,
        { borderColor: colors.border },
        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
      onPress={onPress}
    >
      <Text style={{ color: selected ? colors.onPrimary : colors.text }}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});

export default SongChip;
