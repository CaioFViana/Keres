import type { GuideDrawerId, GuideRect } from './types';

/** Anchor id of a drawer entry, e.g. `drawer:main-system:CharactersStack`. */
export function drawerAnchorId(drawerId: GuideDrawerId, routeName: string): string {
  return `drawer:${drawerId}:${routeName}`;
}

/** Anchor id of a screen region, e.g. `screen:StorySelection:list`. */
export function screenAnchorId(screen: string, part: string): string {
  return `screen:${screen}:${part}`;
}

/**
 * Measurable tour targets, by anchor id. Entries hold a measure closure rather than a rect:
 * window coordinates are only valid at read time (the drawer scrolls, the keyboard opens), so
 * the host measures each step's anchors when the step activates instead of caching layouts.
 */
type AnchorMeasure = () => Promise<GuideRect | null>;

const anchors = new Map<string, AnchorMeasure>();

export function registerGuideAnchor(id: string, measure: AnchorMeasure): void {
  anchors.set(id, measure);
}

export function unregisterGuideAnchor(id: string): void {
  anchors.delete(id);
}

/** Measures every id, skipping the missing and the unmeasurable. Never throws. */
export async function measureGuideAnchors(ids: readonly string[]): Promise<GuideRect[]> {
  const rects = await Promise.all(
    ids.map(async (id) => {
      try {
        return (await anchors.get(id)?.()) ?? null;
      } catch {
        return null;
      }
    }),
  );
  return rects.filter((rect): rect is GuideRect => rect !== null && rect !== undefined);
}

/**
 * The smallest rect covering every input. Zero-area rects (hidden conditional items) are
 * ignored; with nothing left the step degrades to card-only.
 */
export function unionGuideRects(rects: readonly GuideRect[]): GuideRect | null {
  const visible = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  if (visible.length === 0) return null;
  const x = Math.min(...visible.map((rect) => rect.x));
  const y = Math.min(...visible.map((rect) => rect.y));
  const right = Math.max(...visible.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...visible.map((rect) => rect.y + rect.height));
  return { x, y, width: right - x, height: bottom - y };
}

/** Clears the registry between tests. */
export function __resetGuideAnchorsForTests(): void {
  anchors.clear();
}
