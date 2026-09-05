import React from 'react';
import { ScrollView, Text, View, type ScrollViewProps } from 'react-native';
import { useTheme } from '@/src/theme';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
import { screenLayoutStyles, type ContentWidth } from '../ScreenContainer/ScreenContainer';
import ScreenTitle from '../ScreenTitle/ScreenTitle';

interface DetailContainerProps extends ScrollViewProps {
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  width?: ContentWidth;
}

export default function DetailContainer({
  children,
  title,
  description,
  footer,
  width = 'full',
  style,
  contentContainerStyle,
  ...props
}: DetailContainerProps) {
  const { colors } = useTheme();
  const bottomPadding = useFormScrollBottomPadding();
  return (
    <ScrollView
      {...props}
      style={[screenLayoutStyles.surface, { backgroundColor: colors.background }, style]}
      contentContainerStyle={[
        screenLayoutStyles.content,
        width === 'reading' && screenLayoutStyles.reading,
        contentContainerStyle,
        { paddingBottom: bottomPadding },
      ]}
    >
      {title !== undefined && <ScreenTitle variant="detail">{title}</ScreenTitle>}
      {description !== undefined && (
        <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>{description}</Text>
      )}
      {children}
      {footer && <View style={{ marginTop: 20 }}>{footer}</View>}
    </ScrollView>
  );
}
