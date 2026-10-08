import type { Ionicons } from '@expo/vector-icons';

export type MenuIconName = keyof typeof Ionicons.glyphMap;

/** Where the focused drawer entry's own navigator is: its screen name and that screen's params. */
export interface NestedFocus {
  screen?: string;
  params?: Record<string, unknown>;
}

export interface MenuLeaf {
  /** The tour anchor and test id: the route name, unless several entries share one route. */
  id: string;
  route: string;
  label: string;
  icon: MenuIconName;
  /**
   * Opens this screen as the stack's only one, so back and the menu behave the same whatever the stack held
   * before. Absent: the stack's list screen, through the drawer entry's own press listener.
   */
  target?: { screen: string; params?: object };
  /** Whether this entry is the one on screen, given where its route's navigator is. */
  active?: (focus: NestedFocus) => boolean;
}

export interface MenuGroup<Id extends string = string> {
  id: Id;
  labelKey: string;
  /** Stands for the group in its header. */
  icon: MenuIconName;
  leaves: MenuLeaf[];
  /** Open on a fresh start; the group with the screen on show opens regardless. */
  defaultOpen: boolean;
}

/** What an entry says about what is behind it, without opening it. */
export type MenuBadge =
  | { kind: 'count'; value: number; attention?: boolean }
  | { kind: 'dot' }
  | { kind: 'text'; value: string };

/** Badges by entry id. */
export type MenuBadges = Record<string, MenuBadge | undefined>;

/** Whether `leaf` is the entry on screen. Entries without a rule are on screen whenever their route is. */
export function isLeafActive(leaf: MenuLeaf, focusedRoute: string, focus: NestedFocus): boolean {
  if (leaf.route !== focusedRoute) return false;
  return leaf.active ? leaf.active(focus) : true;
}

/** A badge that asks for attention (as opposed to one that only informs). */
export function badgeNeedsAttention(badge: MenuBadge | undefined): boolean {
  if (!badge) return false;
  if (badge.kind === 'dot') return true;
  return badge.kind === 'count' && badge.attention === true;
}
