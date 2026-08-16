import { useCallback, useEffect } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import { useHeaderBackActionStore } from '../state/headerBackActionStore';

interface BackButtonHandlerOptions {
  /**
   * Retained for existing callers. Drawer navigators own visible header navigation, so this
   * option no longer changes the header from a nested screen.
   */
  showWebBackButton?: boolean;
}

/**
 * Custom hook to handle hardware back button presses for nested navigators.
 * It prioritizes going back within the current navigator. If at the root of the nested navigator,
 * it attempts to go back in the parent navigator (DrawerNavigator). If the parent cannot go back,
 * it returns false to allow other BackHandlers (like the app exit handler) to process the event.
 */
export const useBackButtonHandler = ({
  showWebBackButton = false,
}: BackButtonHandlerOptions = {}) => {
  const navigation = useNavigation();
  const setBackAction = useHeaderBackActionStore((state) => state.setBackAction);
  const clearBackAction = useHeaderBackActionStore((state) => state.clearBackAction);

  useFocusEffect(
    useCallback(() => {
      if (!showWebBackButton) {
        return undefined;
      }

      const backAction = () => navigation.goBack();
      setBackAction(backAction);

      return () => clearBackAction(backAction);
    }, [clearBackAction, navigation, setBackAction, showWebBackButton]),
  );

  useEffect(() => {
    const backAction = () => {
      // 1. Try to go back within the current navigator (nested stack)
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true; // Event handled
      } else {
        // 2. If the current nested stack cannot go back, delegate to the parent navigator (DrawerNavigator).
        const parentNavigation = navigation.getParent(); // This is the DrawerNavigator's navigation object

        if (parentNavigation && parentNavigation.canGoBack()) {
          // Check if parent can go back
          parentNavigation.goBack(); // Attempt to go back in the parent (DrawerNavigator)
          return true; // Event handled
        }
        // If no parent navigation, or if the parent cannot go back,
        // return false to allow the event to propagate to other BackHandlers.
        // This is crucial for the MainDashboardScreen's "double press to exit" logic.
        return false; // Event not handled by this hook
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation]);
};
