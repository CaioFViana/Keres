import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '@/src/theme';

export type ContentWidth = 'full' | 'reading';
export const screenLayoutStyles = StyleSheet.create({
  surface: { flex: 1 },
  content: { width: '100%', alignSelf: 'center', padding: 20 },
  reading: { maxWidth: 960 },
});

/** No scrolling: lists and canvases keep ownership of their viewport. */
export default function ScreenContainer({ style, children, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[screenLayoutStyles.surface, { backgroundColor: colors.background }, style]}
    >
      {children}
    </View>
  );
}
