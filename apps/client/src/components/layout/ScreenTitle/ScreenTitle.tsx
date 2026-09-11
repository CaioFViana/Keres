import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { useTheme } from '@/src/theme';

export default function ScreenTitle({
  variant = 'form',
  style,
  ...props
}: TextProps & { variant?: 'form' | 'detail' }) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      {...props}
      style={[
        styles.title,
        { color: colors.text, fontSize: variant === 'detail' ? 28 : 24 },
        style,
      ]}
    />
  );
}
const styles = StyleSheet.create({ title: { fontWeight: 'bold', marginBottom: 5 } });
