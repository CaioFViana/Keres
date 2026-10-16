import { CommonActions } from '@react-navigation/native';
import { useHeaderBackActionStore } from '@/src/state/ui/headerBackActionStore';

interface NavigationStateLike {
  key?: string;
  index: number;
  routeNames?: string[];
  routes: { name: string; params?: object; state?: NavigationStateLike }[];
}

/** What this module needs of a navigation object: any of them (stack, drawer, a test double) will do. */
interface AnyNavigation {
  getState?: () => unknown;
  getParent?: () => unknown;
  dispatch?: unknown;
  navigate: unknown;
}

/**
 * The navigator that has `routeName` among its own routes: this one, or the nearest above it. A
 * screen of a stack reaches the Drawer through `getParent()`; a screen of the Drawer is already there.
 */
export function navigatorWithRoute(
  navigation: AnyNavigation | undefined,
  routeName: string,
): AnyNavigation | undefined {
  let current: AnyNavigation | undefined = navigation;
  while (current) {
    const state = current.getState?.() as NavigationStateLike | undefined;
    if (state?.routeNames?.includes(routeName)) return current;
    current = current.getParent?.() as AnyNavigation | undefined;
  }
  return navigation;
}

export interface StackTarget {
  /** The drawer route that holds the stack. */
  stack: string;
  screen: string;
  params?: object;
}

/**
 * Opens a screen of another drawer stack and makes the back button return to where it was opened from.
 *
 * Every stack of the drawer keeps its own history, and keeps it while the drawer shows another one. A
 * screen opened in it is pushed on top of whatever the stack was last showing, so one tap on back
 * reveals *that* - a list the person left an hour ago - and only a second tap, or a third, reaches
 * the place they came from. The way back is therefore registered for the screen that is opened.
 *
 * A screen in the same stack is just navigated to, with nothing to register. `onReturn` replaces the
 * way back when the origin is not where the person should land (a matrix, a filtered list).
 *
 * `fresh` starts the other stack over - its base screen, then the target - instead of pushing onto what
 * it last showed. A form opened to *create* needs it: a stack that still holds the form of the entity
 * just made would reopen it as an edit of that entity, state and all.
 */
export function navigateAcrossStacks(
  navigation: AnyNavigation | undefined,
  target: StackTarget,
  options?: { onReturn?: () => void; fresh?: boolean },
): void {
  const drawer = navigatorWithRoute(navigation, target.stack);
  if (!drawer) return;
  const state = drawer.getState?.() as NavigationStateLike | undefined;
  const origin = state?.routes[state.index];
  const originScreen = origin?.state?.routes[origin.state.index];

  const leavesItsStack = !!origin && origin.name !== target.stack;
  const returnAction =
    options?.onReturn ??
    (leavesItsStack
      ? () => {
          (drawer.navigate as (name: string, params?: unknown) => void)(origin.name, {
            ...(originScreen
              ? { screen: originScreen.name, params: originScreen.params }
              : undefined),
          });
        }
      : undefined);
  if (returnAction) {
    useHeaderBackActionStore.getState().setCrossStackReturnAction(returnAction, target.screen);
  }

  const nested = state?.routes.find((route) => route.name === target.stack)?.state;
  const base = nested?.routeNames?.[0];
  // A stack that has not drawn yet has no history to discard: it opens on its base screen anyway.
  if (options?.fresh && nested?.key && base && drawer.dispatch) {
    const routes =
      base === target.screen
        ? [{ name: target.screen, params: target.params }]
        : [{ name: base }, { name: target.screen, params: target.params }];
    (drawer.dispatch as (action: unknown) => void)({
      ...CommonActions.reset({ index: routes.length - 1, routes }),
      target: nested.key,
    });
  }

  (drawer.navigate as (name: string, params: unknown) => void)(target.stack, {
    screen: target.screen,
    params: target.params,
  });
}
