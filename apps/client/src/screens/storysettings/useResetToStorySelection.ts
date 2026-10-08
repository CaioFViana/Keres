import { CommonActions, useNavigation } from '@react-navigation/native';
import { useCallback } from 'react';

/**
 * Sends the person back to story selection once the story is no longer theirs to open (deleted, or left).
 * The reset goes to the root navigator, however many navigators the screen sits inside.
 */
export function useResetToStorySelection() {
  const navigation = useNavigation();
  return useCallback(() => {
    let root: { dispatch: (action: never) => void } = navigation;
    for (
      let parent = navigation.getParent?.();
      parent;
      parent = (parent as { getParent?: () => typeof parent }).getParent?.()
    ) {
      root = parent;
    }
    root.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'StorySelection' }] }) as never,
    );
  }, [navigation]);
}
