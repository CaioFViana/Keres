import React, { useEffect, useRef } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { useTheme } from '@/src/theme';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
import {
  OccurrenceLandingContext,
  useOccurrenceLandingController,
} from '@/src/hooks/useOccurrenceLanding';
import type { OccurrenceTarget } from '@/src/utils/occurrenceTarget';
import { screenLayoutStyles, type ContentWidth } from '../ScreenContainer/ScreenContainer';
import ScreenTitle from '../ScreenTitle/ScreenTitle';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

interface DetailContainerProps extends ScrollViewProps {
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  width?: ContentWidth;
  /** Occurrence landing target: the matching field scrolls into view, flashing. */
  landing?: OccurrenceTarget | null;
  /** A tab bar (see `DetailTabs`): it stays at the top of the scroll view, under the title. */
  tabs?: React.ReactNode;
  /** Scrolls back to the top whenever this changes - the tab on show, say. */
  scrollResetKey?: string;
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
  tabs,
  scrollResetKey,
  style,
  contentContainerStyle,
  onScroll,
  ...props
}: DetailContainerProps) {
  const { colors } = useTheme();
  const bottomPadding = useFormScrollBottomPadding();
  const { access, scrollRef, handleScroll } = useOccurrenceLandingController(landing ?? null);
  // The tab bar is a direct child of the scroll view, after the title and the description when there are any.
  const tabsIndex = (title !== undefined ? 1 : 0) + (description !== undefined ? 1 : 0);
  const shownResetKey = useRef(scrollResetKey);
  useEffect(() => {
    if (shownResetKey.current === scrollResetKey) return;
    shownResetKey.current = scrollResetKey;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollRef, scrollResetKey]);
  return (
    <OccurrenceLandingContext.Provider value={access}>
      <ScrollView
        {...props}
        ref={scrollRef}
        stickyHeaderIndices={tabs ? [tabsIndex] : props.stickyHeaderIndices}
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
          <ThemedText tone="secondary" style={{ marginBottom: 20 }}>
            {description}
          </ThemedText>
        )}
        {tabs}
        {children}
        {footer && <View style={{ marginTop: 20 }}>{footer}</View>}
      </ScrollView>
    </OccurrenceLandingContext.Provider>
  );
}
