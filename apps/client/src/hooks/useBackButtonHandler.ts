import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * Custom hook to handle hardware back button presses for nested navigators.
 * It prioritizes going back within the current navigator. If at the root of the nested navigator,
 * it attempts to go back in the parent navigator (DrawerNavigator). If the parent cannot go back,
 * it returns false to allow other BackHandlers (like the app exit handler) to process the event.
 */
export const useBackButtonHandler = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const backAction = () => {
      // 1. Try to go back within the current navigator (nested stack)
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true; // Event handled
      } else {
        // 2. If the current nested stack cannot go back, delegate to the parent navigator (DrawerNavigator).
        const parentNavigation = navigation.getParent(); // This is the DrawerNavigator's navigation object

        if (parentNavigation && parentNavigation.canGoBack()) { // Check if parent can go back
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
