// The stack definitions live in MainSystemStacks; this file composes the drawer.
import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { NavigationState, NavigatorScreenParams } from '@react-navigation/native';
import {
  CommonActions,
  getFocusedRouteNameFromRoute,
  StackActions,
} from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import GalleryMediaViewerOverlay from '@/src/components/features/gallery/GalleryManager/GalleryMediaViewerOverlay';
import PresenceMatrixViewerOverlay from '@/src/components/features/presence-matrix/PresenceMatrixViewerOverlay';
import NavigationBackButton from '../components/common/navigation/NavigationBackButton/NavigationBackButton';
import ResizableDrawerContent, {
  DRAWER_MIN_WIDTH,
  useResizableDrawerWidth,
} from '../components/common/navigation/ResizableDrawerContent/ResizableDrawerContent';
import ArcPickerModal from '../components/features/arcs/ArcPickerModal';
import { screenHelpPage } from '../help/contextualHelp';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useStoryArcs } from '../hooks/useStoryArcs';
import { MentionMatcherProvider } from '../mentions/MentionMatcherProvider';
import { MentionNavigationProvider } from '../mentions/MentionNavigationProvider';
import GlobalSearchScreen from '../screens/globalsearch/GlobalSearchScreen';
import MainDashboardScreen from '../screens/mainstorystack/MainDashboardScreen';
import StoryAnalysisScreen from '../screens/mainstorystack/StoryAnalysisScreen';
import StorySettingsScreen from '../screens/mainstorystack/StorySettingsScreen';
import { readShowcaseRequest } from '../showcase/showcaseRequest';
import { useHeaderBackActionStore } from '../state/headerBackActionStore';
import { useStoryStore } from '../state/storyStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { useStoryVocabulary } from '../vocabulary/useStoryVocabulary';
import { DRAWER_SWIPE_EDGE_WIDTH, DRAWER_SWIPE_MIN_DISTANCE } from './drawerInteraction';
import type { HelpStackParamList } from './HelpStack';
import HelpStackNavigator from './HelpStack';
import type { StoryDevicesStackParamList } from './StoryDevicesStack';
import StoryDevicesStackNavigator from './StoryDevicesStack';
import {
  ArcContextDrawerScreen,
  drawerIcon,
  DrawerToggleButton,
  type MainDashboardScreenNavigationProp,
  mainSystemStackRootScreens,
} from './MainSystemDrawerHelpers';

import {
  BoardsStackNavigator,
  CharacterStackNavigator,
  CommentsStackNavigator,
  CustomizationStackNavigator,
  GalleryStackNavigator,
  ItemStackNavigator,
  LocationStackNavigator,
  NarrativeElementsStackNavigator,
  NoteStackNavigator,
  OperationLogStackNavigator,
  PlotsStackNavigator,
  TagStackNavigator,
  WorldRuleStackNavigator,
  type BoardStackParamList,
  type CharacterStackParamList,
  type CommentsStackParamList,
  type CustomizationStackParamList,
  type GalleryStackParamList,
  type ItemStackParamList,
  type LocationStackParamList,
  type NarrativeElementsStackParamList,
  type NotesStackParamList,
  type OperationLogStackParamList,
  type PlotsStackParamList,
  type TagsStackParamList,
  type WorldRulesStackParamList,
} from './MainSystemStacks';

export type {
  BoardStackParamList,
  CharacterStackParamList,
  CommentsStackParamList,
  CustomizationStackParamList,
  GalleryStackParamList,
  ItemDetailScreenParamList,
  ItemStackParamList,
  LocationStackParamList,
  NarrativeElementsStackParamList,
  NotesStackParamList,
  OperationLogStackParamList,
  PlotsStackParamList,
  TagsStackParamList,
  WorldRulesStackParamList,
} from './MainSystemStacks';

export type MainSystemDrawerParamList = {
  MainDashboard: undefined;
  ArcContext: undefined;
  GlobalSearch: undefined;
  // Every stack below accepts an optional `{ screen, params }` for the same reason: each `Drawer.Screen`
  // has its own `drawerItemPress` (see further below) that navigates explicitly to the stack's list screen
  // when tapped in the menu, instead of letting the Drawer restore the nested state as it was.
  CharactersStack: NavigatorScreenParams<CharacterStackParamList> | undefined;
  LocationsStack: NavigatorScreenParams<LocationStackParamList> | undefined;
  NarrativeElementsStack: NavigatorScreenParams<NarrativeElementsStackParamList> | undefined;
  ItemsStack: NavigatorScreenParams<ItemStackParamList> | undefined;
  TagsStack: NavigatorScreenParams<TagsStackParamList> | undefined;
  WorldRulesStack: NavigatorScreenParams<WorldRulesStackParamList> | undefined;
  PlotsStack: NavigatorScreenParams<PlotsStackParamList> | undefined;
  NotesStack: NavigatorScreenParams<NotesStackParamList> | undefined;
  GalleryStack: NavigatorScreenParams<GalleryStackParamList> | undefined;
  BoardsStack: NavigatorScreenParams<BoardStackParamList> | undefined;
  Settings: undefined;
  StorySettings: { storyId: string };
  StoryAnalysis: { storyId: string };
  OperationLogStack: NavigatorScreenParams<OperationLogStackParamList> | undefined;
  CommentsStack: NavigatorScreenParams<CommentsStackParamList> | undefined;
  CustomizationStack: NavigatorScreenParams<CustomizationStackParamList> | undefined;
  StorySelection: undefined;
  StoryDevicesDrawer: NavigatorScreenParams<StoryDevicesStackParamList>;
  HelpDrawer: NavigatorScreenParams<HelpStackParamList>;
};

const Drawer = createDrawerNavigator<MainSystemDrawerParamList>();

const MainSystemNavigator = () => {
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const { t } = useTranslation();
  const { term } = useStoryVocabulary();
  const { arcs, activeArc, activeArcId, setActiveArcId, showSelector } = useStoryArcs();
  const [arcPickerOpen, setArcPickerOpen] = React.useState(false);
  const showContextualHelp = useUserSettingsStore((state) => state.showContextualHelp);
  const suggestLiteraryDevices = useUserSettingsStore((state) => state.suggestLiteraryDevices);
  const nestedBackAction = useHeaderBackActionStore((state) => state.backAction);
  const { isCompact, isWide, width: viewportWidth } = useResponsiveLayout();
  const { drawerWidth, setDrawerWidth, maximumWidth } = useResizableDrawerWidth(viewportWidth);
  const compactDrawerWidth = Math.ceil(viewportWidth * 0.6);

  return (
    <MentionMatcherProvider>
      <Drawer.Navigator
        // Every screen is wrapped so a mention can open its target: `navigateToEntityDetail` needs
        // the drawer's navigation object, which does not exist above the navigator.
        screenLayout={({ children }) => (
          <MentionNavigationProvider>{children}</MentionNavigationProvider>
        )}
        // The showcase opens straight into the requested item; outside it, the story's dashboard, as always.
        initialRouteName={readShowcaseRequest()?.stack as keyof MainSystemDrawerParamList}
        defaultStatus={isWide ? 'open' : 'closed'}
        backBehavior="history"
        drawerContent={(props) => (
          <ResizableDrawerContent
            {...props}
            drawerWidth={drawerWidth}
            maximumWidth={maximumWidth}
            onDrawerWidthChange={setDrawerWidth}
            resizable={!isCompact}
          />
        )}
        screenOptions={({ navigation, route }) => {
          const activeRouteName = getFocusedRouteNameFromRoute(route) ?? route.name;
          const helpPageId = screenHelpPage[activeRouteName];
          const nestedState = (route as typeof route & { state?: NavigationState }).state;
          const focusedNestedRoute = nestedState?.routes[nestedState.index ?? 0];
          const isHelpPage =
            activeRouteName === 'HelpPage' || focusedNestedRoute?.name === 'HelpPage';
          const nestedStackKey = nestedState?.key;
          const isNestedDestination =
            activeRouteName !== route.name && !mainSystemStackRootScreens.has(activeRouteName);
          const showNestedBackButton =
            isNestedDestination ||
            (nestedState?.type === 'stack' && (nestedState.index ?? 0) > 0 && nestedStackKey);
          const goBackInNestedStack = () => {
            // Resolve the nested navigator lazily: the route object received while the header
            // mounts can hold a partial state, while Drawer navigation always has the live one.
            const liveDrawerRoute = navigation
              .getState()
              .routes.find((drawerRoute) => drawerRoute.key === route.key) as
              | (typeof route & { state?: NavigationState })
              | undefined;
            const target = liveDrawerRoute?.state?.key ?? nestedStackKey;

            if (target) {
              navigation.dispatch({ ...StackActions.pop(), target });
            } else {
              navigation.dispatch(StackActions.pop());
            }
          };

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
                      nestedBackAction ??
                      (() => navigation.navigate('HelpDrawer', { screen: 'HelpIndex' }))
                    }
                  />
                )
              : showNestedBackButton || !isWide || (showContextualHelp && helpPageId)
                ? () => (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {showNestedBackButton ? (
                        <NavigationBackButton onPress={nestedBackAction ?? goBackInNestedStack} />
                      ) : null}
                      {!isWide ? (
                        <DrawerToggleButton
                          navigation={navigation as MainDashboardScreenNavigationProp}
                        />
                      ) : null}
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
        }}
      >
        <Drawer.Screen
          name="MainDashboard"
          component={MainDashboardScreen}
          options={{
            title: selectedStory?.title || t('dashboard_title'),
            drawerIcon: drawerIcon('home-outline'),
            // The current story has to stand out from the drawer's other entries, which are only navigation -
            // without this, the story's name gets lost in the list as if it were just another item like
            // "Characters" or "Locations".
            drawerLabel: ({ focused }) => (
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: focused ? colors.primary : colors.text,
                }}
                numberOfLines={1}
              >
                {selectedStory?.title || t('dashboard_title')}
              </Text>
            ),
          }}
        />
        <Drawer.Screen
          name="ArcContext"
          component={ArcContextDrawerScreen}
          options={{
            title: activeArc?.title || t('all_arcs', { arcs: term('Arc', true) }),
            drawerIcon: drawerIcon(
              (activeArc?.icon as keyof typeof Ionicons.glyphMap) || 'library-outline',
            ),
            drawerLabel: () => (
              <Text style={{ fontSize: 15, color: colors.text }} numberOfLines={1}>
                {activeArc?.title || t('all_arcs', { arcs: term('Arc', true) })}
              </Text>
            ),
            drawerItemStyle: {
              height: showSelector ? undefined : 0,
              overflow: 'hidden',
            },
          }}
          listeners={{
            drawerItemPress: (event) => {
              event.preventDefault();
              setArcPickerOpen(true);
            },
          }}
        />
        <Drawer.Screen
          name="GlobalSearch"
          component={GlobalSearchScreen}
          options={{
            title: t('global_search_title'),
            drawerLabel: t('global_search_title'),
            drawerIcon: drawerIcon('search-outline'),
          }}
        />
        <Drawer.Screen
          name="CharactersStack"
          component={CharacterStackNavigator}
          options={{
            title: term('Character', true),
            drawerLabel: term('Character', true),
            drawerIcon: drawerIcon('people-outline'),
          }}
          listeners={({ navigation }) => ({
            // The Drawer's default behaviour, when an item is tapped, restores the nested state exactly as it was
            // (that is how tabs preserve navigation - it is intentional in most apps). Here we want the opposite:
            // tapping "Characters" should always lead to the list, not to wherever the stack was left.
            // `preventDefault` blocks that restoration, and navigating straight to the "Characters" route (the
            // stack's root) makes the stack navigator discard everything above it - without depending on a separate
            // global event and hoping the ListScreen is mounted in time to hear it.
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('CharactersStack', { screen: 'Characters' });
            },
          })}
        />
        <Drawer.Screen
          name="NarrativeElementsStack"
          component={NarrativeElementsStackNavigator}
          options={{
            title: t('narrative_elements_title'),
            drawerLabel: t('narrative_elements_title'),
            drawerIcon: drawerIcon('book-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('NarrativeElementsStack', { screen: 'NarrativeElements' });
            },
          })}
        />
        <Drawer.Screen
          name="PlotsStack"
          component={PlotsStackNavigator}
          options={{
            title: t('plots_title'),
            drawerLabel: t('plots_title'),
            drawerIcon: drawerIcon('git-branch-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('PlotsStack', { screen: 'Plots' });
            },
          })}
        />
        <Drawer.Screen
          name="LocationsStack"
          component={LocationStackNavigator}
          options={{
            title: term('Location', true),
            drawerLabel: term('Location', true),
            drawerIcon: drawerIcon('map-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('LocationsStack', { screen: 'Locations' });
            },
          })}
        />
        <Drawer.Screen
          name="ItemsStack"
          component={ItemStackNavigator}
          options={{
            title: term('Item', true),
            drawerLabel: term('Item', true),
            drawerIcon: drawerIcon('cube-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('ItemsStack', { screen: 'Items' });
            },
          })}
        />
        <Drawer.Screen
          name="TagsStack"
          component={TagStackNavigator}
          options={{
            title: t('tags_title'),
            drawerLabel: t('tags_title'),
            drawerIcon: drawerIcon('pricetag-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('TagsStack', { screen: 'Tags' });
            },
          })}
        />
        <Drawer.Screen
          name="WorldRulesStack"
          component={WorldRuleStackNavigator}
          options={{
            title: t('world_title'),
            drawerLabel: t('world_title'),
            drawerIcon: drawerIcon('globe-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('WorldRulesStack', { screen: 'WorldIndex' });
            },
          })}
        />
        <Drawer.Screen
          name="NotesStack"
          component={NoteStackNavigator}
          options={{
            title: t('notes_title'),
            drawerLabel: t('notes_title'),
            drawerIcon: drawerIcon('document-text-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('NotesStack', { screen: 'Notes' });
            },
          })}
        />
        <Drawer.Screen
          name="GalleryStack"
          component={GalleryStackNavigator}
          options={{
            title: t('gallery_title'),
            drawerLabel: t('gallery_title'),
            drawerIcon: drawerIcon('images-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('GalleryStack', { screen: 'GalleryList' });
            },
          })}
        />
        <Drawer.Screen
          name="BoardsStack"
          component={BoardsStackNavigator}
          options={{
            title: t('boards_title'),
            drawerLabel: t('boards_title'),
            drawerIcon: drawerIcon(
              getEntityAppearance('Board').icon as keyof typeof Ionicons.glyphMap,
            ),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('BoardsStack', { screen: 'BoardList' });
            },
          })}
        />
        <Drawer.Screen
          name="CustomizationStack"
          component={CustomizationStackNavigator}
          options={{
            title: t('customization_title'),
            drawerLabel: t('customization_title'),
            drawerIcon: drawerIcon('color-wand-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('CustomizationStack', { screen: 'CustomizationIndex' });
            },
          })}
        />
        <Drawer.Screen
          name="CommentsStack"
          component={CommentsStackNavigator}
          options={{
            title: t('comments_title'),
            drawerLabel: t('comments_title'),
            drawerIcon: drawerIcon('chatbubbles-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('CommentsStack', { screen: 'CommentsList' });
            },
          })}
        />
        <Drawer.Screen
          name="OperationLogStack"
          component={OperationLogStackNavigator}
          options={{
            title: t('operation_logs_title'),
            drawerLabel: t('operation_logs_title'),
            drawerIcon: drawerIcon('time-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('OperationLogStack', { screen: 'OperationLog' });
            },
          })}
        />
        <Drawer.Screen
          name="StoryAnalysis"
          component={StoryAnalysisScreen}
          options={{
            title: t('story_analysis_title'),
            drawerIcon: drawerIcon('analytics-outline'),
          }}
        />
        <Drawer.Screen
          name="StoryDevicesDrawer"
          component={StoryDevicesStackNavigator}
          options={{
            title: t('story_devices_title'),
            drawerLabel: t('story_devices_title'),
            drawerIcon: drawerIcon('bulb-outline'),
            // The screen stays registered when the setting is off so a direct navigation or a help link does not
            // break; only the menu item disappears.
            drawerItemStyle: {
              height: suggestLiteraryDevices ? undefined : 0,
              overflow: 'hidden',
            },
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('StoryDevicesDrawer', { screen: 'DeviceIndex' });
            },
          })}
        />
        <Drawer.Screen
          name="HelpDrawer"
          component={HelpStackNavigator}
          options={{
            title: t('help_title'),
            drawerLabel: t('help_title'),
            drawerIcon: drawerIcon('help-circle-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('HelpDrawer', { screen: 'HelpIndex' });
            },
          })}
        />
        <Drawer.Screen
          name="StorySettings"
          component={StorySettingsScreen}
          options={{ title: t('story_settings_title'), drawerIcon: drawerIcon('settings-outline') }}
        />
        <Drawer.Screen
          name="StorySelection"
          component={() => <View />} // A dummy component, as it won't be displayed
          options={{
            title: t('story_selection_title'),
            drawerIcon: drawerIcon('exit-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              const rootStackNavigation = navigation.getParent();
              if (rootStackNavigation) {
                rootStackNavigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'StorySelection' }],
                  }),
                );
              } else {
                console.error(
                  'Could not find root stack navigation to dispatch reset action. This is unexpected.',
                );
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'StorySelection' }],
                  }),
                );
              }
            },
          })}
        />
      </Drawer.Navigator>
      <GalleryMediaViewerOverlay />
      <PresenceMatrixViewerOverlay />
      <ArcPickerModal
        visible={arcPickerOpen}
        arcs={arcs}
        activeArcId={activeArcId}
        onSelect={setActiveArcId}
        onClose={() => setArcPickerOpen(false)}
      />
    </MentionMatcherProvider>
  );
};

export default MainSystemNavigator;
