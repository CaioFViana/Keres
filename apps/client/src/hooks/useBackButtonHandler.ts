import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useNavigation } from '@react-navigation/native';

/**
 * Custom hook to handle hardware back button presses for nested navigators.
 * It prioritizes going back within the current navigator. If at the root of the nested navigator,
 * it attempts to go back in the parent navigator (DrawerNavigator).
 */
export const useBackButtonHandler = () => {
  const navigation = useNavigation();

  useEffect(() => {
    const backAction = () => {
      if (navigation.canGoBack()) {
        navigation.goBack(); // Go back within the current nested stack
        return true; // Event handled
      } else {
        // If the current nested stack cannot go back, delegate to the parent navigator (DrawerNavigator).
        // The DrawerNavigator will then decide if it can go back (e.g., to MainDashboard).
        const parentNavigation = navigation.getParent();
        if (parentNavigation) {
          parentNavigation.goBack(); // Attempt to go back in the parent (DrawerNavigator)
          return true; // Event handled
        }
        // If no parent navigation, then this is an unexpected state or the absolute root.
        // For example, if MainDashboardScreen (which is at the root of the Drawer) somehow
        // uses this hook, and has no parent. But MainDashboardScreen should have its own handler.
        return false; // Event not handled, allow default behavior or be handled by another BackHandler
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [navigation]);
};