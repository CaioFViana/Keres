import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/src/theme';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

interface ScreenSectionProps {
  title: React.ReactNode;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export default function ScreenSection({
  title,
  description,
  actions,
  children,
}: ScreenSectionProps) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        {actions}
      </View>
      {description && (
        <ThemedText tone="secondary" style={{ marginBottom: 8 }}>
          {description}
        </ThemedText>
      )}
      {children}
    </View>
  );
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 15, marginBottom: 5 },
  title: { flex: 1, fontSize: 18, fontWeight: 'bold' },
});
