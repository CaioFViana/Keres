import { useCallback, useMemo, useState } from 'react';

/**
 * A list that shows the active arc's entities, and what a search finds beyond it.
 *
 * While nothing is typed the list is exactly the arc's. While a search is typed, the entities the
 * search found in other arcs are counted instead of silently hidden, and one tap shows them too (for
 * that search only: typing something else, or clearing it, puts the arc back).
 */
export function useArcSearchScope<T>(
  /** What the search (and the filters) found, in every arc. */
  items: T[],
  /** Whether an entity is in the arc being looked at. */
  inArc: (item: T) => boolean,
  /** The text being searched for; empty when nothing is. */
  searchTerm: string | undefined,
) {
  const term = (searchTerm ?? '').trim();
  // Remembered with the term it was asked for, so a new search never starts expanded.
  const [expandedFor, setExpandedFor] = useState<string | null>(null);
  const inside = useMemo(() => items.filter(inArc), [items, inArc]);
  const outsideCount = term ? items.length - inside.length : 0;
  const expanded = term !== '' && outsideCount > 0 && expandedFor === term;
  const toggle = useCallback(
    () => setExpandedFor((current) => (current === term ? null : term)),
    [term],
  );
  return { data: expanded ? items : inside, outsideCount, expanded, toggle };
}
