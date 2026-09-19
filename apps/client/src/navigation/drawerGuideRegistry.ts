import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import type { GuideDrawerId, GuideRect } from '../guides/types';

/** The navigation object a drawer content receives (emit, dispatch, navigate, getState). */
export type GuideDrawerNavigation = DrawerContentComponentProps['navigation'];

/**
 * The live drawer handles, by navigator. `GuideHost` lives at the app root, outside any drawer,
 * so it cannot `useNavigation` its way to one; each `ResizableDrawerContent` registers itself on
 * mount instead. Anything here may be absent (the other stack is showing) - callers degrade to
 * card-only steps, never a throw.
 */
export interface GuideDrawerHandle {
  navigation: GuideDrawerNavigation;
  scrollTo: (y: number) => void;
  getScrollOffset: () => number;
  /** Window Y of the drawer's scroll view, or `null` when it cannot be measured. */
  measureScrollWindowY: () => Promise<number | null>;
}

const handles = new Map<GuideDrawerId, GuideDrawerHandle>();

export function registerGuideDrawer(drawerId: GuideDrawerId, handle: GuideDrawerHandle): void {
  handles.set(drawerId, handle);
}

export function unregisterGuideDrawer(drawerId: GuideDrawerId): void {
  handles.delete(drawerId);
}

export function getGuideDrawer(drawerId: GuideDrawerId): GuideDrawerHandle | undefined {
  return handles.get(drawerId);
}

/**
 * Scrolls the drawer so the window-addressed rect lands `margin` below the drawer's top edge.
 * The math goes through window coordinates on purpose: item wrappers report no content offset,
 * and the drawer's own padding would corrupt any parent-relative arithmetic.
 */
export async function scrollDrawerToRect(
  drawerId: GuideDrawerId,
  rect: GuideRect,
  margin: number,
): Promise<void> {
  const handle = handles.get(drawerId);
  if (!handle) return;
  const scrollWindowY = await handle.measureScrollWindowY();
  if (scrollWindowY === null) return;
  handle.scrollTo(Math.max(0, handle.getScrollOffset() + (rect.y - scrollWindowY) - margin));
}

/** Clears the registry between tests. */
export function __resetGuideDrawersForTests(): void {
  handles.clear();
}
