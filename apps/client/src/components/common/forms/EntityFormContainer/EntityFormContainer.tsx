import React from 'react';
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import ScreenTitle from '@/src/components/layout/ScreenTitle/ScreenTitle';
import {
  screenLayoutStyles,
  type ContentWidth,
} from '@/src/components/layout/ScreenContainer/ScreenContainer';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import { useTheme } from '@/src/theme';

interface EntityFormContainerProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  width?: ContentWidth;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}

/** Entity editing layout; validation, operations and permissions belong to the caller. */
export default function EntityFormContainer({
  children,
  title,
  description,
  actions,
  width = 'full',
  style,
  contentContainerStyle,
  keyboardVerticalOffset,
}: EntityFormContainerProps) {
  const { colors } = useTheme();
  return (
    <KeyboardAwareScreen
      style={[{ backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        screenLayoutStyles.content,
        styles.content,
        width === 'reading' && screenLayoutStyles.reading,
        contentContainerStyle,
      ]}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {title !== undefined && <ScreenTitle>{title}</ScreenTitle>}
      {description !== undefined && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      )}
      {children}
      {actions && <FormActions stackOnCompact>{actions}</FormActions>}
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1 },
  description: { marginBottom: 20 },
});
