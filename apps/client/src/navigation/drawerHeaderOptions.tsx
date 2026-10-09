import { Ionicons } from '@expo/vector-icons';
import type { DrawerNavigationOptions, DrawerNavigationProp } from '@react-navigation/drawer';
import type { NavigationState, ParamListBase, Route } from '@react-navigation/native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import NavigationBackButton from '../components/common/navigation/NavigationBackButton/NavigationBackButton';
import {
  DRAWER_MIN_WIDTH,
  useResizableDrawerWidth,
} from '../components/common/navigation/ResizableDrawerContent/ResizableDrawerContent';
import { screenHelpPage } from '../help/contextualHelp';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useHeaderBackActionStore } from '../state/headerBackActionStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { DrawerToggleButton } from './MainSystemDrawerHelpers';
import { DRAWER_SWIPE_EDGE_WIDTH, DRAWER_SWIPE_MIN_DISTANCE } from './drawerInteraction';

/**
 * The layout and header state both drawers (the main one and the story-selection one) read. Each
 * navigator calls it once and hands the result to its `ResizableDrawerContent` and `drawerScreenOptions`.
 */
export function useDrawerChrome() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const showContextualHelp = useUserSettingsStore((state) => state.showContextualHelp);
  const nestedBackAction = useHeaderBackActionStore((state) => state.backAction);
  const { isCompact, isWide, width: viewportWidth } = useResponsiveLayout();
  const { drawerWidth, setDrawerWidth, maximumWidth } = useResizableDrawerWidth(viewportWidth);
  const compactDrawerWidth = Math.ceil(viewportWidth * 0.6);

  return {
    t,
    colors,
    showContextualHelp,
    nestedBackAction,
    isCompact,
    isWide,
    drawerWidth,
    setDrawerWidth,
    maximumWidth,
    compactDrawerWidth,
  };
}

export type DrawerChrome = ReturnType<typeof useDrawerChrome>;

/** What a drawer header reads from the route on show: the screen in front and the stack behind it. */
export function readDrawerHeaderRoute(route: Route<string>) {
  const activeRouteName = getFocusedRouteNameFromRoute(route) ?? route.name;
  const nestedState = (route as { state?: NavigationState }).state;
  const focusedNestedRoute = nestedState?.routes[nestedState.index ?? 0];

  return {
    activeRouteName,
    helpPageId: screenHelpPage[activeRouteName],
    isHelpPage: activeRouteName === 'HelpPage' || focusedNestedRoute?.name === 'HelpPage',
    nestedStackKey: nestedState?.key,
    /** The nested stack has a screen behind its top one, so its own back arrow applies. */
    nestedStackHasBack:
      nestedState?.type === 'stack' && (nestedState.index ?? 0) > 0 && Boolean(nestedState.key),
  };
}

export type DrawerHeaderRoute = ReturnType<typeof readDrawerHeaderRoute>;

/**
 * The header and drawer options every screen of a drawer gets. The navigator decides whether the
 * nested back arrow shows and where it goes; everything else (the help shortcut, the menu button,
 * the drawer's width and swipe behaviour) is the same for both drawers.
 */
export function drawerScreenOptions({
  chrome,
  navigation,
  route,
  header,
  showNestedBackButton,
  goBack,
}: {
  chrome: DrawerChrome;
  navigation: DrawerNavigationProp<ParamListBase>;
  route: { name: string };
  header: DrawerHeaderRoute;
  showNestedBackButton: boolean;
  goBack: () => void;
}): DrawerNavigationOptions {
  const {
    t,
    colors,
    showContextualHelp,
    nestedBackAction,
    isCompact,
    isWide,
    drawerWidth,
    compactDrawerWidth,
  } = chrome;
  const { helpPageId, isHelpPage } = header;

  return {
    headerShown: true,
    headerStatusBarHeight: 0,
    headerStyle: {
      backgroundColor: colors.surface,
    },
    headerTintColor: colors.text,
    headerTitleContainerStyle:
      !isHelpPage && !showNestedBackButton && isWide && !showContextualHelp
        ? { marginLeft: 15 }
        : undefined,
    // The nested screens use headerRight for actions such as create and edit. The help shortcut stays on
    // the left so it remains visible when those actions take over the right-hand side of the drawer's
    // header.
    headerLeft: isHelpPage
      ? () => (
          <NavigationBackButton
            onPress={
              nestedBackAction ?? (() => navigation.navigate('HelpDrawer', { screen: 'HelpIndex' }))
            }
          />
        )
      : showNestedBackButton || !isWide || (showContextualHelp && helpPageId)
        ? () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {showNestedBackButton ? (
                <NavigationBackButton onPress={nestedBackAction ?? goBack} />
              ) : null}
              {!isWide ? <DrawerToggleButton navigation={navigation} /> : null}
              {showContextualHelp && helpPageId ? (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate('HelpDrawer', {
                      screen: 'HelpPage',
                      params: { pageId: helpPageId, returnDrawerRoute: route.name },
                    })
                  }
                  style={{ marginLeft: showNestedBackButton || !isWide ? 8 : 15 }}
                  accessibilityLabel={t('help_title')}
                >
                  <Ionicons name="help-circle-outline" size={26} color={colors.text} />
                </TouchableOpacity>
              ) : null}
            </View>
          )
        : () => null,
    headerRight: undefined,
    drawerActiveTintColor: colors.primary,
    drawerInactiveTintColor: colors.text,
    drawerType: isWide ? 'permanent' : 'front',
    swipeEnabled: !isWide,
    swipeEdgeWidth: isWide ? 0 : DRAWER_SWIPE_EDGE_WIDTH,
    swipeMinDistance: DRAWER_SWIPE_MIN_DISTANCE,
    drawerStyle: {
      backgroundColor: colors.surface,
      minWidth: isCompact ? compactDrawerWidth : DRAWER_MIN_WIDTH,
      width: isCompact ? compactDrawerWidth : drawerWidth,
    },
  };
}
