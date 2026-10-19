import React, { useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
} from 'react-native';
import { useTheme } from '@/src/theme';
import { useFormScrollBottomPadding } from '@/src/hooks/forms/useFormScrollBottomPadding';
import {
  OccurrenceLandingContext,
  useOccurrenceLandingController,
} from '@/src/hooks/nav/useOccurrenceLanding';
import type { OccurrenceTarget } from '@/src/utils/entity/occurrenceTarget';
import {
  screenLayoutStyles,
  type ContentWidth,
} from '@/src/components/layout/ScreenContainer/ScreenContainer';
import ScreenTitle from '@/src/components/layout/ScreenTitle/ScreenTitle';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

interface DetailContainerProps extends ScrollViewProps {
  title?: string;
  description?: string;
  footer?: React.ReactNode;
  width?: ContentWidth;
  /** Occurrence landing target: the matching field scrolls into view, flashing. */
  landing?: OccurrenceTarget | null;
  /**
   * A tab bar (see `DetailTabs`): it sits under the title, and stays at the top of the screen once
   * the page scrolls past it.
   */
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
  // The bar is not a `stickyHeaderIndices` header: on native its stuck position is only a transform, so
  // the touch area stays where the bar was laid out and a tab pressed after scrolling hits nothing.
  // Past its place in the page it is drawn again, in layout, over the top of the screen.
  const [bar, setBar] = useState({ top: 0, height: 0 });
  const [stuck, setStuck] = useState(false);
  const barTop = useRef(0);
  const measureBar = (event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    barTop.current = y;
    setBar({ top: y, height });
  };
  const shownResetKey = useRef(scrollResetKey);
  useEffect(() => {
    if (shownResetKey.current === scrollResetKey) return;
    shownResetKey.current = scrollResetKey;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [scrollRef, scrollResetKey]);
  return (
    <OccurrenceLandingContext.Provider value={access}>
      <View style={screenLayoutStyles.surface}>
        <ScrollView
          scrollEventThrottle={16}
          {...props}
          ref={scrollRef}
          onScroll={(event) => {
            handleScroll(event);
            if (tabs) setStuck(event.nativeEvent.contentOffset.y >= barTop.current);
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
          {tabs && (
            <View
              testID="detail-tabs-slot"
              onLayout={measureBar}
              style={stuck ? { height: bar.height } : undefined}
            >
              {!stuck && tabs}
            </View>
          )}
          {children}
          {footer && <View style={{ marginTop: 20 }}>{footer}</View>}
        </ScrollView>
        {tabs && stuck && (
          <View pointerEvents="box-none" style={styles.stuckBar} testID="detail-tabs-stuck">
            <View
              style={[styles.stuckBarContent, width === 'reading' && screenLayoutStyles.reading]}
            >
              {tabs}
            </View>
          </View>
        )}
      </View>
    </OccurrenceLandingContext.Provider>
  );
}

const styles = StyleSheet.create({
  stuckBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  // The content is padded by 20; the tab bar runs edge to edge over that padding.
  stuckBarContent: { width: '100%', alignSelf: 'center', paddingHorizontal: 20 },
});
