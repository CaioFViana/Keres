import { findFirstExcerptMatch, type TextRange } from '@keres/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ScrollView } from 'react-native';
import type { OccurrenceTarget } from '../utils/occurrenceTarget';
import { computeScrollAdjustment } from '../utils/scrollIntoView';

/** How long the landed occurrence keeps its strong fill before fading to plain. */
export const OCCURRENCE_FLASH_MS = 2000;
// Comfort zone above and below the landed occurrence, like manuscript search's margin.
const LANDING_MARGIN = 96;

interface OccurrenceLandingAccess {
  target: OccurrenceTarget | null;
  requestScroll: (host: unknown) => void;
}

const NO_LANDING: OccurrenceLandingAccess = { target: null, requestScroll: () => {} };

/**
 * The detail screen's landing target plus the way to scroll to it, for any field
 * that draws text. Defaults to inert: fields outside a landing container (tests,
 * forms, stories without the provider) render exactly as before.
 */
export const OccurrenceLandingContext =
  createContext<OccurrenceLandingAccess>(NO_LANDING);

type Measurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

const asMeasurable = (node: unknown): Measurable | null =>
  node && typeof (node as Measurable).measureInWindow === 'function'
    ? (node as Measurable)
    : null;

/**
 * The detail screen's half of occurrence landing: owns the scroller, measures
 * landing requests the manuscript way (window rects, one settle retry,
 * generations against stale continuations) and scrolls the occurrence into view
 * with a comfort margin.
 */
export function useOccurrenceLandingController(target: OccurrenceTarget | null) {
  const scrollRef = useRef<ScrollView | null>(null);
  const offsetRef = useRef(0);
  // Every request runs under a generation: a newer request (fresh data after an
  // entity swap) invalidates whatever the previous layout still had in flight.
  const generationRef = useRef(0);
  const requestScroll = useCallback((host: unknown) => {
    const generation = (generationRef.current += 1);
    const measurable = asMeasurable(host);
    if (!measurable) return;
    const measure = (retries: number) => {
      if (generation !== generationRef.current) return;
      measurable.measureInWindow((_x, segY, _width, segHeight) => {
        if (generation !== generationRef.current) return;
        const scroller = asMeasurable(scrollRef.current);
        if (!scroller) return;
        // Unlaid-out hosts measure zeros; one retry lets the fresh row settle.
        if (segHeight <= 0 && retries > 0) {
          setTimeout(() => measure(retries - 1), 120);
          return;
        }
        if (segHeight <= 0) return;
        scroller.measureInWindow((viewX, viewY, viewWidth, viewHeight) => {
          if (generation !== generationRef.current) return;
          const delta = computeScrollAdjustment({
            segTop: segY,
            segBottom: segY + segHeight,
            viewTop: viewY,
            viewBottom: viewY + viewHeight,
            margin: LANDING_MARGIN,
          });
          if (delta !== null) {
            scrollRef.current?.scrollTo({
              y: Math.max(0, offsetRef.current + delta),
              animated: true,
            });
          }
        });
      });
    };
    requestAnimationFrame(() => measure(1));
  }, []);
  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      offsetRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );
  const access = useMemo(() => ({ target, requestScroll }), [target, requestScroll]);
  return { access, scrollRef, handleScroll };
}

/**
 * The field's half: whether this field is the landing target, plus the needle
 * located in its rendered value while the flash is on. The flash arms per
 * target identity (render-phase reset, the sanctioned pattern) and fades on its
 * timer; every navigation carries a fresh target object, so re-landings re-arm.
 */
export function useOccurrenceFlash(fieldKey: string | undefined, value: string) {
  const { target, requestScroll } = useContext(OccurrenceLandingContext);
  const targeted = !!fieldKey && !!target && target.field === fieldKey;
  const anchor = useMemo(() => {
    if (!targeted || !target?.needle) return null;
    return findFirstExcerptMatch(value, target.needle);
  }, [targeted, target, value]);
  const key = targeted ? target : null;
  const [armedKey, setArmedKey] = useState<unknown>(null);
  const [flashOn, setFlashOn] = useState(false);
  if (key !== armedKey) {
    setArmedKey(key);
    setFlashOn(!!key);
  }
  useEffect(() => {
    if (!flashOn) return;
    const timer = setTimeout(() => setFlashOn(false), OCCURRENCE_FLASH_MS);
    return () => clearTimeout(timer);
  }, [flashOn]);
  const flashRanges: TextRange[] = flashOn && anchor ? [anchor] : [];
  return { targeted, target, flashRanges, requestScroll };
}
