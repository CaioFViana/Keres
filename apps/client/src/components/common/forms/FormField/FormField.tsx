import React, { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme';

interface FormFieldProps {
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children:
    | React.ReactNode
    | ((accessibility: {
        accessibilityLabel: string;
        accessibilityLabelledBy: string;
      }) => React.ReactNode);
}

/** Render children as a function when the control supports native input accessibility props. */
export default function FormField({ label, required, help, error, children }: FormFieldProps) {
  const { colors } = useTheme();
  const labelId = useId();
  return (
    <View>
      <Text nativeID={labelId} style={[styles.label, { color: colors.text }]}>
        {label}
        {required ? ' *' : ''}
      </Text>
      {typeof children === 'function'
        ? children({ accessibilityLabel: label, accessibilityLabelledBy: labelId })
        : children}
      {help && <Text style={[styles.hint, { color: colors.textSecondary }]}>{help}</Text>}
      {error && (
        <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: colors.error }]}>
          {error}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  hint: { marginTop: 5 },
});
