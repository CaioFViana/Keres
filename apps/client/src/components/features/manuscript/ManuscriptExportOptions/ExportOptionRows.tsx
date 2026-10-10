import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { useTheme } from '@/src/theme';

/** The rows the manuscript export screen is made of: sections, choices, switches. */

function useRowStyles() {
  const { colors } = useTheme();
  return useMemo(
    () =>
      StyleSheet.create({
        section: {
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: '700',
          marginTop: 20,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        },
        label: { color: colors.text, fontSize: 15, marginBottom: 6, marginTop: 6 },
        option: {
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: 8,
          borderWidth: 1,
          flexDirection: 'row',
          gap: 12,
          marginBottom: 8,
          minHeight: 50,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        optionSelected: { borderColor: colors.primary, borderWidth: 2 },
        optionLabel: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
        pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
        pill: {
          borderColor: colors.border,
          borderRadius: 16,
          borderWidth: 1,
          paddingHorizontal: 14,
          paddingVertical: 8,
          backgroundColor: colors.surface,
        },
        pillSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
        pillText: { color: colors.text, fontSize: 14 },
        pillTextSelected: { color: colors.onPrimary, fontWeight: '700' },
        switchRow: {
          alignItems: 'center',
          flexDirection: 'row',
          gap: 12,
          justifyContent: 'space-between',
          paddingVertical: 8,
        },
        switchLabel: { color: colors.text, flex: 1, fontSize: 15 },
      }),
    [colors],
  );
}

export const OptionSection: React.FC<{ title: string }> = ({ title }) => {
  const styles = useRowStyles();
  return <Text style={styles.section}>{title}</Text>;
};

/** One choice among a few, as a full-width row: formats, arcs. */
export function OptionRow({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
}) {
  const styles = useRowStyles();
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? colors.primary : colors.textSecondary}
      />
      <Text style={styles.optionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

/** One short choice among a few, as pills under a label: sizes, styles, separators. */
export function OptionPills<T extends string | number>({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  testID: string;
}) {
  const styles = useRowStyles();
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <TouchableOpacity
              key={String(option.value)}
              testID={`${testID}-${option.value}`}
              style={[styles.pill, selected && styles.pillSelected]}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function SwitchRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID: string;
}) {
  const styles = useRowStyles();
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <ThemedSwitch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
      />
    </View>
  );
}
