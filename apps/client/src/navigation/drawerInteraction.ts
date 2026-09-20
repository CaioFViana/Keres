/**
 * Keep drawer drags deliberate and edge-only: entity canvases, carousels and horizontal controls
 * should remain free to use their own gestures away from the left bezel.
 */
export const DRAWER_SWIPE_EDGE_WIDTH = 28;
export const DRAWER_SWIPE_MIN_DISTANCE = 24;

interface DrawerItemPressEvent {
  preventDefault: () => void;
}

interface DrawerItemNavigation {
  navigate: (...args: [string, object?] | [string]) => void;
  closeDrawer: () => void;
}

/**
 * The `drawerItemPress` listener shared by menu entries.
 *
 * The router only auto-closes on a route-index change, so tapping the focused entry would
 * leave the menu open over it; the explicit close keeps every entry consistent. Stack entries
 * pass their root screen: the drawer's default tap restores the nested state exactly as it was
 * (that is how tabs preserve navigation - intentional in most apps), but here the tap should
 * always lead to the list, so `preventDefault` blocks that restoration and navigating straight
 * to the root makes the stack navigator discard everything above it. Only genuinely special
 * entries (the arc picker, the root reset) keep inline listeners.
 */
export function drawerItemListeners(routeName: string, screen?: string) {
  return ({ navigation }: { navigation: DrawerItemNavigation }) => ({
    drawerItemPress: (event: DrawerItemPressEvent) => {
      event.preventDefault();
      if (screen === undefined) {
        navigation.navigate(routeName);
      } else {
        navigation.navigate(routeName, { screen });
      }
      navigation.closeDrawer();
    },
  });
}
