import type { ManuscriptSection, OrdinalMatchLocation, TextRange } from '@keres/shared';
import {
  findAllCaseInsensitiveMatches,
  findManuscriptMatches,
  locateOrdinalMatch,
  sectionIndexForMatch,
} from '@keres/shared';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { FlatList, Text, View } from 'react-native';
import { computeScrollAdjustment } from '../../../utils/scrollIntoView';

// Comfort zone kept clear above and below the current search hit when it scrolls into view.
const ACTIVE_MATCH_MARGIN = 96;

/**
 * Everything the manuscript's search owns: the query and ordinal state, the counter's
 * matches, the title marks, the ordinal jump, and the fine scroll that brings the
 * current hit into view inside its section (scenes run for pages, so the section jump
 * alone cannot promise the hit is visible).
 *
 * The indexed jump itself stays with the caller: search matches and index picks share
 * it, and it also positions the reader for the index highlight.
 */
export function useManuscriptSearch(
  sections: ManuscriptSection[],
  listRef: React.RefObject<FlatList<ManuscriptSection> | null>,
  scrollToSectionIndex: (index: number) => void,
) {
  const [query, setQuery] = useState('');
  const [ordinal, setOrdinal] = useState(0);
  const { matches, total } = useMemo(
    () => findManuscriptMatches(sections, query),
    [sections, query],
  );
  // The counter's current hit, located down to the name/body it sits in: without it,
  // next/prev inside one section only moves the counter, and the reader sees nothing
  // advance until a hit far enough away scrolls the list.
  const activeMatch: OrdinalMatchLocation | null = useMemo(
    () => (total === 0 ? null : locateOrdinalMatch(sections, matches, query, ordinal)),
    [sections, matches, query, ordinal, total],
  );
  // Search marks follow the counter's own rule (case-insensitive, scene names and
  // bodies): ranges over the bare name, shifted past the "position. " prefix the list
  // adds. Bodies mark through `MarkdownPreview`; container headings never match. The
  // current hit additionally lands in `active`, drawn with the strong fill.
  const titleMarksByKey = useMemo(() => {
    const ranges = new Map<string, TextRange[]>();
    const active = new Map<string, TextRange[]>();
    if (!query.trim()) return { ranges, active };
    sections.forEach((section, sectionIndex) => {
      if (section.kind !== 'scene') return;
      const prefixLength = `${section.position}. `.length;
      const hits = findAllCaseInsensitiveMatches(section.scene.name, query).map((range) => ({
        start: range.start + prefixLength,
        length: range.length,
      }));
      if (hits.length > 0) ranges.set(section.key, hits);
      if (
        activeMatch &&
        activeMatch.sectionIndex === sectionIndex &&
        activeMatch.nameMatchIndex >= 0
      ) {
        const hit = hits[activeMatch.nameMatchIndex];
        if (hit) active.set(section.key, [hit]);
      }
    });
    return { ranges, active };
  }, [sections, query, activeMatch]);
  // Derived-state reset during render (the sanctioned pattern, not an effect): a new query
  // or new sections invalidate the current match position, so the ordinal restarts at the
  // first match. React re-renders immediately with ordinal 0; no stale jump escapes.
  const [prevQuery, setPrevQuery] = useState(query);
  const [prevSections, setPrevSections] = useState(sections);
  if (query !== prevQuery || sections !== prevSections) {
    setPrevQuery(query);
    setPrevSections(sections);
    setOrdinal(0);
  }
  // Match navigation wraps past both ends: prev from the first match lands on the last,
  // next from the last lands on the first. Each jump scrolls the owning section near the top.
  const jumpToOrdinal = useCallback(
    (next: number) => {
      if (total === 0) return;
      const wrapped = ((next % total) + total) % total;
      setOrdinal(wrapped);
      scrollToSectionIndex(sectionIndexForMatch(matches, wrapped));
    },
    [matches, total, scrollToSectionIndex],
  );

  // The list viewport doubles as the scroll-into-view frame; the caller merges this ref
  // with whatever else anchors the list view (the guide tour owns that prop today).
  const viewportRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);
  // Every fine scroll runs under a generation: a newer attach (a fresh navigation) or
  // a detach invalidates whatever the previous hit still had in flight
  // (requestAnimationFrame, the unlaid-out retry). Without it, the stale continuation
  // fires after the jump and yanks the list away from the new hit - most visibly for
  // title hits, which had no correction of their own to win the race back.
  const scrollGenerationRef = useRef(0);
  const handleListScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );
  // Fires when the active host mounts, which covers near jumps (the ref moves) and far
  // ones (the row renders after the jump). Titles attach the same ref as bodies: the
  // indexed jump is only coarse, and whatever it misses the measured scroll corrects.
  const scrollActiveIntoView = useCallback(
    (node: unknown) => {
      const generation = (scrollGenerationRef.current += 1);
      if (!node || typeof (node as Text).measureInWindow !== 'function') return;
      const measure = (retries: number) => {
        if (generation !== scrollGenerationRef.current) return;
        (node as Text).measureInWindow((segX, segY, segWidth, segHeight) => {
          if (generation !== scrollGenerationRef.current) return;
          const viewport = viewportRef.current;
          if (!viewport || typeof viewport.measureInWindow !== 'function') return;
          // Unlaid-out hosts measure zeros; one retry lets the fresh row settle.
          if (segHeight <= 0 && retries > 0) {
            setTimeout(() => measure(retries - 1), 120);
            return;
          }
          if (segHeight <= 0) return;
          viewport.measureInWindow((viewX, viewY, viewWidth, viewHeight) => {
            if (generation !== scrollGenerationRef.current) return;
            const delta = computeScrollAdjustment({
              segTop: segY,
              segBottom: segY + segHeight,
              viewTop: viewY,
              viewBottom: viewY + viewHeight,
              margin: ACTIVE_MATCH_MARGIN,
            });
            if (delta !== null) {
              listRef.current?.scrollToOffset({
                offset: Math.max(0, scrollOffsetRef.current + delta),
                animated: true,
              });
            }
          });
        });
      };
      requestAnimationFrame(() => measure(1));
    },
    [listRef],
  );

  return {
    query,
    setQuery,
    ordinal,
    matches,
    total,
    activeMatch,
    titleMarksByKey,
    jumpToOrdinal,
    viewportRef,
    handleListScroll,
    scrollActiveIntoView,
  };
}
