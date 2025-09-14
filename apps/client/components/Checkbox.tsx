import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface CheckboxProps {
  label: string;
  value: boolean;
  onValueChange: (newValue: boolean) => void;
}

export default function Checkbox({
  label,
  value,
  onValueChange,
}: CheckboxProps) {
  const borderColor = useThemeColor({}, 'borderColor');
  const accentColor = useThemeColor({}, 'contrastBlue'); // Using contrastBlue from theme

  return (
    <Pressable onPress={() => onValueChange(!value)} style={styles.container}>
      <ThemedText style={styles.label}>{label}</ThemedText> {/* Label first */}
      <View
        style={[
          styles.checkbox,
          { borderColor: borderColor },
          value && { backgroundColor: accentColor }, // Use accentColor from theme
        ]}
      >
        {value && <ThemedText style={styles.checkmark}>✓</ThemedText>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    // width: '100%', // Removed
    // marginVertical: 8, // Removed
    paddingVertical: 16,   // Further increased click area
    paddingHorizontal: 16, // Further increased click area
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8, // Changed to marginLeft to put space after label
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
  },
});
