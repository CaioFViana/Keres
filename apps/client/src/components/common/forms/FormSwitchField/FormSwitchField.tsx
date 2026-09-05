import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { useTheme } from '@/src/theme';

type FormSwitchFieldProps = React.ComponentProps<typeof ThemedSwitch> & { label: string };

export default function FormSwitchField({ label, ...props }: FormSwitchFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <ThemedSwitch accessibilityLabel={label} {...props} />
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 15,
    marginBottom: 5,
    minHeight: 44,
  },
  label: { flex: 1, fontSize: 16, fontWeight: 'bold' },
});
