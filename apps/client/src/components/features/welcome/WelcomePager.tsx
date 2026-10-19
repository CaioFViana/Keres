import React, { useCallback, useEffect, useRef } from 'react';
import type { ScrollView } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface UseWelcomePagerOptions {
  /** The page on screen, as the screen knows it: buttons change it, the swipe reports it. */
  page: number;
  pageWidth: number;
  onPageChange: (page: number) => void;
}

/**
 * Keeps the screen's idea of the current page and the pager's position as one.
 *
 * Either one can be the one that moves: a button changes `page` and the pager scrolls there; a swipe
 * - or a trackpad, or a mouse wheel - moves the pager and the page is reported as soon as the scroll
 * passes the middle between two pages, not when it comes to rest. Waiting for the rest was the bug:
 * some inputs never send the "momentum ended" event, so the dots showed the third page while the
 * screen still believed in the first - Back hidden, Next going nowhere.
 *
 * A scroll the code itself started (a button) is not reported on the way: passing the middle
 * pages on the way to the third would otherwise turn a request for the third into the second.
 */
export function useWelcomePager({ page, pageWidth, onPageChange }: UseWelcomePagerOptions) {
  const scrollRef = useRef<ScrollView>(null);
  /** The horizontal offset, kept on the UI thread so the swipe drives animations without a render per frame. */
  const scrollX = useSharedValue(0);
  /** The page a scroll started by code is heading to, or -1 when there is none. */
  const heading = useSharedValue(-1);
  /** The page last reported or requested, on both threads, so only a change is ever reported. */
  const known = useSharedValue(page);
  const knownRef = useRef(page);

  const report = useCallback(
    (next: number) => {
      knownRef.current = next;
      onPageChange(next);
    },
    [onPageChange],
  );

  const onScroll = useAnimatedScrollHandler({
    // A hand on the pager takes it back from whatever code was scrolling it.
    onBeginDrag: () => {
      heading.value = -1;
    },
    onScroll: (event) => {
      const x = event.contentOffset.x;
      scrollX.value = x;
      if (pageWidth <= 0) return;
      if (heading.value >= 0) {
        // Arrived (within a pixel or two): from here on the scroll is the person's again.
        if (Math.abs(x - heading.value * pageWidth) < 2) heading.value = -1;
        return;
      }
      const at = Math.round(x / pageWidth);
      if (at !== known.value) {
        known.value = at;
        scheduleOnRN(report, at);
      }
    },
  });

  // A page asked for from outside - a button, the back key - scrolls there. One that the scroll
  // itself just reported is already where it should be, and must not be scrolled to again.
  useEffect(() => {
    if (page === knownRef.current) return;
    knownRef.current = page;
    known.value = page;
    heading.value = page;
    scrollRef.current?.scrollTo({ x: page * pageWidth, animated: true });
    // Inputs with no "begin drag" (a wheel, a trackpad) cannot take it back: it is given back anyway.
    const giveBack = setTimeout(() => {
      heading.value = -1;
    }, 900);
    return () => clearTimeout(giveBack);
  }, [page, pageWidth, known, heading]);

  // A window that changes width moves the pages: stay on the one being read.
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: knownRef.current * pageWidth, animated: false });
  }, [pageWidth]);

  // Separate, not an object: a ref may only be handed on as it is, never read out of a bundle.
  return [scrollX, scrollRef, onScroll] as const;
}

interface WelcomePagerProps {
  scrollRef: ReturnType<typeof useWelcomePager>[1];
  onScroll: ReturnType<typeof useWelcomePager>[2];
  pageWidth: number;
  children: React.ReactNode;
}

/**
 * The welcome's pages side by side in a horizontal, paged scroll: a swipe moves between them, and
 * the buttons ask for the same movement. All pages stay mounted - that is what lets the next one
 * slide in under the finger instead of appearing after it.
 */
const WelcomePager: React.FC<WelcomePagerProps> = ({
  scrollRef,
  onScroll,
  pageWidth,
  children,
}) => (
  <Animated.ScrollView
    ref={scrollRef as never}
    horizontal
    pagingEnabled
    bounces={false}
    showsHorizontalScrollIndicator={false}
    keyboardShouldPersistTaps="handled"
    scrollEventThrottle={16}
    onScroll={onScroll}
    style={{ width: pageWidth, flexGrow: 0 }}
    testID="welcome-pager"
  >
    {children}
  </Animated.ScrollView>
);

export default WelcomePager;
