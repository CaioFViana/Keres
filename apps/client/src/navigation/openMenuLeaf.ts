import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { CommonActions } from '@react-navigation/native';
import type { MenuLeaf, NestedFocus } from './drawerMenuModel';

type DrawerNavigation = DrawerContentComponentProps['navigation'];
type DrawerState = DrawerContentComponentProps['state'];

/** Where the focused drawer entry's navigator is, read from the drawer's state. */
export function nestedFocusOf(state: DrawerState): { route: string; focus: NestedFocus } {
  const route = state.routes[state.index] as (typeof state.routes)[number] & {
    state?: { index?: number; routes: { name: string; params?: object }[] };
    params?: { screen?: string; params?: Record<string, unknown> };
  };
  const nested = route.state;
  const focused = nested?.routes[nested.index ?? nested.routes.length - 1];
  if (focused) {
    return {
      route: route.name,
      focus: {
        screen: focused.name,
        params: focused.params as Record<string, unknown> | undefined,
      },
    };
  }
  // A navigator that has not drawn yet knows only the screen it was asked to open.
  return {
    route: route.name,
    focus: { screen: route.params?.screen, params: route.params?.params },
  };
}

/**
 * Opens a menu entry.
 *
 * An entry with no target goes through the drawer entry's own press listener, as every entry always has: the
 * listener returns its stack to the list. An entry with a target replaces whatever its stack held with that one
 * screen, then shows the stack - so the manuscript, a world category or the chapter list is a place in the
 * menu, with no history of the last visit stacked under it and no back arrow to a screen nobody came from.
 */
export function openMenuLeaf(
  navigation: DrawerNavigation,
  state: DrawerState,
  leaf: MenuLeaf,
): void {
  const drawerRoute = state.routes.find((route) => route.name === leaf.route) as
    | ((typeof state.routes)[number] & { state?: { key?: string } })
    | undefined;

  if (!leaf.target) {
    const event = drawerRoute
      ? navigation.emit({
          type: 'drawerItemPress',
          target: drawerRoute.key,
          canPreventDefault: true,
        })
      : undefined;
    if (!event?.defaultPrevented) {
      navigation.navigate(leaf.route as never);
      navigation.closeDrawer();
    }
    return;
  }

  const { screen, params } = leaf.target;
  const nestedKey = drawerRoute?.state?.key;
  if (nestedKey) {
    navigation.dispatch({
      ...CommonActions.reset({ index: 0, routes: [{ name: screen, params }] }),
      target: nestedKey,
    });
  }
  (navigation.navigate as (name: string, params?: object) => void)(leaf.route, { screen, params });
  navigation.closeDrawer();
}
