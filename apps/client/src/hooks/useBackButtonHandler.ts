import { createElement, useCallback, useEffect } from 'react';
import { NavigationProp, ParamListBase, useFocusEffect, useNavigation } from '@react-navigation/native';
import { BackHandler, Platform } from 'react-native';
import NavigationBackButton from '../components/common/NavigationBackButton/NavigationBackButton';
import NavigationDrawerButton from '../components/common/NavigationDrawerButton/NavigationDrawerButton';
import { useResponsiveLayout } from './useResponsiveLayout';

const findDrawerNavigation = (navigation: NavigationProp<ParamListBase>) => {
  let currentNavigation: NavigationProp<ParamListBase> | undefined = navigation;

  for (let depth = 0; currentNavigation && depth < 5; depth += 1) {
    if (currentNavigation.getState().type === 'drawer') {
      return currentNavigation;
    }
    currentNavigation = currentNavigation.getParent();
  }

  return undefined;
};

interface BackButtonHandlerOptions {
  /** Show the web header button for this screen. Android uses its system button separately. */
  showWebBackButton?: boolean;
}

/**
 * Custom hook to handle hardware back button presses for nested navigators.
 * It prioritizes going back within the current navigator. If at the root of the nested navigator,
 * it attempts to go back in the parent navigator (DrawerNavigator). If the parent cannot go back,
 * it returns false to allow other BackHandlers (like the app exit handler) to process the event.
 */
export const useBackButtonHandler = ({ showWebBackButton = false }: BackButtonHandlerOptions = {}) => {
  const navigation = useNavigation();
  const { isWide } = useResponsiveLayout();

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        return undefined;
      }

      const typedNavigation = navigation as NavigationProp<ParamListBase>;
      const drawerNavigation = findDrawerNavigation(typedNavigation);

      if (!drawerNavigation) {
        return undefined;
      }

      drawerNavigation.setOptions({
        headerLeft: showWebBackButton
          ? () => createElement(NavigationBackButton, { onPress: () => typedNavigation.goBack() })
          : isWide
            ? () => null
            : () => createElement(NavigationDrawerButton, { navigation: drawerNavigation }),
      });
    }, [isWide, navigation, showWebBackButton])
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
