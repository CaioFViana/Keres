import { useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';
import { useHeaderBackActionStore } from '@/src/state/ui/headerBackActionStore';

/**
 * How a screen closes itself - after a save, on cancel - the way its back button does: to where it was
 * opened from, when it was opened across stacks (the dashboard's shortcut to an arc), and one screen back in
 * its own stack otherwise.
 *
 * The way back is taken once, and it has to be taken here too: a save that only popped the stack would leave
 * it registered, for the next back press of the screen to take instead of its own.
 */
export function useLeaveScreen(): () => void {
  const navigation = useNavigation();
  const consumeCrossStackReturnAction = useHeaderBackActionStore(
    (state) => state.consumeCrossStackReturnAction,
  );

  return useCallback(() => {
    let screen: string | undefined;
    try {
      const state = navigation.getState?.();
      screen = state?.routes[state.index]?.name;
    } catch {
      screen = undefined;
    }
    const wayBack = consumeCrossStackReturnAction(screen);
    if (wayBack) wayBack();
    else navigation.goBack();
  }, [consumeCrossStackReturnAction, navigation]);
}
