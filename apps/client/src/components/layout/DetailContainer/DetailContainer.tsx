import React from 'react';
import { ScrollView, Text, View, type ScrollViewProps } from 'react-native';
import { useTheme } from '@/src/theme';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
import {
  OccurrenceLandingContext,
  useOccurrenceLandingController,
} from '@/src/hooks/useOccurrenceLanding';
import type { OccurrenceTarget } from '@/src/utils/occurrenceTarget';
import { screenLayoutStyles, type ContentWidth } from '../ScreenContainer/ScreenContainer';
import ScreenTitle from '../ScreenTitle/ScreenTitle';

interface DetailContainerProps extends ScrollViewProps {
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  width?: ContentWidth;
  /** Occurrence landing target: the matching field scrolls into view, flashing. */
  landing?: OccurrenceTarget | null;
}

/**
 * Read-only detail layout: title, optional description, scrolling body and an optional
 * footer. A plain `ScrollView`, not `KeyboardAwareScreen` - detail screens display data;
 * editing screens use `EntityFormContainer`, which owns keyboard avoidance and the
 * closing action row.
 */

export default function DetailContainer({
  children,
  title,
  description,
  footer,
  width = 'full',
  landing,
  style,
  contentContainerStyle,
  onScroll,
  ...props
}: DetailContainerProps) {
  const { colors } = useTheme();
  const bottomPadding = useFormScrollBottomPadding();
  const { access, scrollRef, handleScroll } = useOccurrenceLandingController(landing ?? null);
  return (
    <OccurrenceLandingContext.Provider value={access}>
      <ScrollView
        {...props}
        ref={scrollRef}
        onScroll={(event) => {
          handleScroll(event);
          onScroll?.(event);
        }}
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
    </OccurrenceLandingContext.Provider>
  );
}
