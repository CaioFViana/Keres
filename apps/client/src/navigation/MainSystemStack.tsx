// The stack definitions live in MainSystemStacks; this file composes the drawer.
import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { CommonActions, useNavigation } from '@react-navigation/native';
import React from 'react';
import { View } from 'react-native';

import GalleryMediaViewerOverlay from '@/src/components/features/gallery/GalleryManager/GalleryMediaViewerOverlay';
import PresenceMatrixViewerOverlay from '@/src/components/features/presence-matrix/PresenceMatrixViewerOverlay';
import MainDrawerMenu from '../components/common/navigation/MainDrawerMenu/MainDrawerMenu';
import ResizableDrawerContent from '../components/common/navigation/ResizableDrawerContent/ResizableDrawerContent';
import ArcPickerModal from '../components/features/arcs/ArcPickerModal';
import { useStoryArcs } from '../hooks/useStoryArcs';
import { MentionMatcherProvider } from '../mentions/MentionMatcherProvider';
import { MentionNavigationProvider } from '../mentions/MentionNavigationProvider';
import GlobalSearchScreen from '../screens/globalsearch/GlobalSearchScreen';
import MainDashboardScreen from '../screens/mainstorystack/MainDashboardScreen';
import { readShowcaseRequest } from '../showcase/showcaseRequest';
import { useHeaderBackActionStore } from '../state/headerBackActionStore';
import { useStoryStore } from '../state/storyStore';
import { entityEventEmitter } from '../utils/EventEmitter';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useStoryVocabulary } from '../vocabulary/useStoryVocabulary';
import { drawerItemListeners } from './drawerInteraction';
import { drawerScreenOptions, readDrawerHeaderRoute, useDrawerChrome } from './drawerHeaderOptions';
import type { ArcsStackParamList } from './ArcsStack';
import ArcsStackNavigator from './ArcsStack';
import type { CalendarsStackParamList } from './CalendarsStack';
import CalendarsStackNavigator from './CalendarsStack';
import type { StatsStackParamList } from './StatsStack';
import StatsStackNavigator from './StatsStack';
import type { HelpStackParamList } from './HelpStack';
import HelpStackNavigator from './HelpStack';
import type { StoryDevicesStackParamList } from './StoryDevicesStack';
import StoryDevicesStackNavigator from './StoryDevicesStack';
import type { StorySettingsStackParamList } from './StorySettingsStack';
import StorySettingsStackNavigator from './StorySettingsStack';
import type { StoryShareStackParamList } from './StoryShareStack';
import StoryShareStackNavigator from './StoryShareStack';
import {
  ArcContextDrawerScreen,
  drawerIcon,
  drawerStoredIcon,
  headerBackAction,
  mainSystemStackRootScreens,
} from './MainSystemDrawerHelpers';

import {
  BoardsStackNavigator,
  CharacterStackNavigator,
  CommentsStackNavigator,
  GalleryStackNavigator,
  ItemStackNavigator,
  LocationStackNavigator,
  NarrativeElementsStackNavigator,
  NoteStackNavigator,
  OperationLogStackNavigator,
  PlotsStackNavigator,
  SketchStackNavigator,
  SongStackNavigator,
  StoryAnalysisStackNavigator,
  TagStackNavigator,
  WorldRuleStackNavigator,
  type BoardStackParamList,
  type CharacterStackParamList,
  type CommentsStackParamList,
  type GalleryStackParamList,
  type ItemStackParamList,
  type LocationStackParamList,
  type NarrativeElementsStackParamList,
  type NotesStackParamList,
  type OperationLogStackParamList,
  type PlotsStackParamList,
  type SketchStackParamList,
  type SongStackParamList,
  type StoryAnalysisStackParamList,
  type TagsStackParamList,
  type WorldRulesStackParamList,
} from './MainSystemStacks';

export type {
  BoardStackParamList,
  CharacterStackParamList,
  CommentsStackParamList,
  GalleryStackParamList,
  ItemDetailScreenParamList,
  ItemStackParamList,
  LocationStackParamList,
  NarrativeElementsStackParamList,
  NotesStackParamList,
  OperationLogStackParamList,
  PlotsStackParamList,
  SketchStackParamList,
  SongStackParamList,
  StoryAnalysisStackParamList,
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
  SketchStack: NavigatorScreenParams<SketchStackParamList> | undefined;
  SongStack: NavigatorScreenParams<SongStackParamList> | undefined;
  Settings: undefined;
  StorySettings: NavigatorScreenParams<StorySettingsStackParamList> | undefined;
  StoryShare: NavigatorScreenParams<StoryShareStackParamList> | undefined;
  StoryAnalysisStack: NavigatorScreenParams<StoryAnalysisStackParamList> | undefined;
  OperationLogStack: NavigatorScreenParams<OperationLogStackParamList> | undefined;
  CommentsStack: NavigatorScreenParams<CommentsStackParamList> | undefined;
  ArcsStack: NavigatorScreenParams<ArcsStackParamList> | undefined;
  CalendarsStack: NavigatorScreenParams<CalendarsStackParamList> | undefined;
  StatsStack: NavigatorScreenParams<StatsStackParamList> | undefined;
  StorySelection: undefined;
  StoryDevicesDrawer: NavigatorScreenParams<StoryDevicesStackParamList>;
  HelpDrawer: NavigatorScreenParams<HelpStackParamList>;
};

const Drawer = createDrawerNavigator<MainSystemDrawerParamList>();

const MainSystemNavigator = () => {
  const chrome = useDrawerChrome();
  const { t, isCompact, isWide, drawerWidth, setDrawerWidth, maximumWidth } = chrome;
  const { selectedStory } = useStoryStore();
  const rootNavigation = useNavigation();
  const { term } = useStoryVocabulary();
  const { arcs, activeArc, activeArcId, setActiveArcId, showSelector } = useStoryArcs();
  const [arcPickerOpen, setArcPickerOpen] = React.useState(false);
  const suggestLiteraryDevices = useUserSettingsStore((state) => state.suggestLiteraryDevices);
  const crossStackReturnScreen = useHeaderBackActionStore((state) => state.crossStackReturnScreen);

  // The story on screen was taken away (the owner removed this person, say): its local copy is gone, so
  // leave it rather than keep showing - and saving to - a story that no longer exists here.
  React.useEffect(() => {
    const onAccessLost = (storyId: string) => {
      const { selectedStory: open, setSelectedStory } = useStoryStore.getState();
      if (open?.id !== storyId) return;
      setSelectedStory(null);
      rootNavigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'StorySelection' }] }),
      );
    };
    entityEventEmitter.on('story_access_lost', onAccessLost);
    return () => entityEventEmitter.off('story_access_lost', onAccessLost);
  }, [rootNavigation]);

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
            drawerId="main-system"
            drawerWidth={drawerWidth}
            maximumWidth={maximumWidth}
            onDrawerWidthChange={setDrawerWidth}
            resizable={!isCompact}
          >
            <MainDrawerMenu
              state={props.state}
              navigation={props.navigation}
              drawerId="main-system"
              story={
                selectedStory
                  ? { title: selectedStory.title, typeLabel: t(selectedStory.type) }
                  : null
              }
              arcLabel={
                showSelector
                  ? activeArc?.title || t('all_arcs', { arcs: term('Arc', true) })
                  : undefined
              }
            />
          </ResizableDrawerContent>
        )}
        screenOptions={({ navigation, route }) => {
          const header = readDrawerHeaderRoute(route);
          const isNestedDestination =
            header.activeRouteName !== route.name &&
            !mainSystemStackRootScreens.has(header.activeRouteName);
          // A root screen has no arrow - nothing is behind it - unless a shortcut elsewhere opened it and left
          // the way back: the dashboard's Read, Analysis and History cards open roots of other stacks.
          const isRootWithWayBack =
            header.activeRouteName !== route.name &&
            crossStackReturnScreen === header.activeRouteName;

          return drawerScreenOptions({
            chrome,
            navigation,
            route,
            header,
            showNestedBackButton:
              isNestedDestination || isRootWithWayBack || header.nestedStackHasBack,
            goBack: headerBackAction({
              navigation,
              routeKey: route.key,
              fallbackStackKey: header.nestedStackKey,
              screen: header.activeRouteName,
            }),
          });
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
            // A text label, not a <Text> of its own: the drawer gives text labels the navigation theme's
            // font, and a custom element would fall back to the platform default - a different typeface.
            drawerLabel: selectedStory?.title || t('dashboard_title'),
            drawerLabelStyle: { fontSize: 16, fontWeight: 'bold' },
          }}
          listeners={drawerItemListeners('MainDashboard')}
        />
        <Drawer.Screen
          name="ArcContext"
          component={ArcContextDrawerScreen}
          options={{
            title: activeArc?.title || t('all_arcs', { arcs: term('Arc', true) }),
            drawerIcon: drawerStoredIcon(activeArc?.icon, 'library-outline'),
            drawerLabel: activeArc?.title || t('all_arcs', { arcs: term('Arc', true) }),
            drawerItemStyle: {
              height: showSelector ? undefined : 0,
              overflow: 'hidden',
            },
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (event) => {
              event.preventDefault();
              setArcPickerOpen(true);
              navigation.closeDrawer();
            },
          })}
        />
        <Drawer.Screen
          name="GlobalSearch"
          component={GlobalSearchScreen}
          options={{
            title: t('global_search_title'),
            drawerLabel: t('global_search_title'),
            drawerIcon: drawerIcon('search-outline'),
          }}
          listeners={drawerItemListeners('GlobalSearch')}
        />
        <Drawer.Screen
          name="CharactersStack"
          component={CharacterStackNavigator}
          options={{
            title: term('Character', true),
            drawerLabel: term('Character', true),
            drawerIcon: drawerIcon('people-outline'),
          }}
          listeners={drawerItemListeners('CharactersStack', 'Characters')}
        />
        <Drawer.Screen
          name="NarrativeElementsStack"
          component={NarrativeElementsStackNavigator}
          options={{
            title: t('narrative_elements_title'),
            drawerLabel: t('narrative_elements_title'),
            drawerIcon: drawerIcon('book-outline'),
          }}
          listeners={drawerItemListeners('NarrativeElementsStack', 'NarrativeElements')}
        />
        <Drawer.Screen
          name="PlotsStack"
          component={PlotsStackNavigator}
          options={{
            title: t('plots_title'),
            drawerLabel: t('plots_title'),
            drawerIcon: drawerIcon('git-branch-outline'),
          }}
          listeners={drawerItemListeners('PlotsStack', 'Plots')}
        />
        <Drawer.Screen
          name="LocationsStack"
          component={LocationStackNavigator}
          options={{
            title: term('Location', true),
            drawerLabel: term('Location', true),
            drawerIcon: drawerIcon('map-outline'),
          }}
          listeners={drawerItemListeners('LocationsStack', 'Locations')}
        />
        <Drawer.Screen
          name="ItemsStack"
          component={ItemStackNavigator}
          options={{
            title: term('Item', true),
            drawerLabel: term('Item', true),
            drawerIcon: drawerIcon('cube-outline'),
          }}
          listeners={drawerItemListeners('ItemsStack', 'Items')}
        />
        <Drawer.Screen
          name="TagsStack"
          component={TagStackNavigator}
          options={{
            title: t('tags_title'),
            drawerLabel: t('tags_title'),
            drawerIcon: drawerIcon('pricetag-outline'),
          }}
          listeners={drawerItemListeners('TagsStack', 'Tags')}
        />
        <Drawer.Screen
          name="WorldRulesStack"
          component={WorldRuleStackNavigator}
          options={{
            title: t('world_title'),
            drawerLabel: t('world_title'),
            drawerIcon: drawerIcon('globe-outline'),
          }}
          listeners={drawerItemListeners('WorldRulesStack', 'WorldRules')}
        />
        <Drawer.Screen
          name="NotesStack"
          component={NoteStackNavigator}
          options={{
            title: t('notes_title'),
            drawerLabel: t('notes_title'),
            drawerIcon: drawerIcon('document-text-outline'),
          }}
          listeners={drawerItemListeners('NotesStack', 'Notes')}
        />
        <Drawer.Screen
          name="GalleryStack"
          component={GalleryStackNavigator}
          options={{
            title: t('gallery_title'),
            drawerLabel: t('gallery_title'),
            drawerIcon: drawerIcon('images-outline'),
          }}
          listeners={drawerItemListeners('GalleryStack', 'GalleryList')}
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
          listeners={drawerItemListeners('BoardsStack', 'BoardList')}
        />
        <Drawer.Screen
          name="SketchStack"
          component={SketchStackNavigator}
          options={{
            title: t('sketches_title'),
            drawerLabel: t('sketches_title'),
            drawerIcon: drawerIcon(
              getEntityAppearance('Sketch').icon as keyof typeof Ionicons.glyphMap,
            ),
            // Sketches live inside Gallery (header pencil button), not in the drawer menu:
            // the route stays registered so Gallery can navigate to it.
            drawerItemStyle: { height: 0, overflow: 'hidden' },
          }}
          listeners={drawerItemListeners('SketchStack', 'SketchList')}
        />
        <Drawer.Screen
          name="SongStack"
          component={SongStackNavigator}
          options={{
            title: t('songs_title'),
            drawerLabel: t('songs_title'),
            drawerIcon: drawerIcon(
              getEntityAppearance('Song').icon as keyof typeof Ionicons.glyphMap,
            ),
            // Songs live inside Gallery (header button) and in a scene's music, not in the drawer
            // menu: the route stays registered so they can navigate to it.
            drawerItemStyle: { height: 0, overflow: 'hidden' },
          }}
          listeners={drawerItemListeners('SongStack', 'SongList')}
        />
        <Drawer.Screen
          name="ArcsStack"
          component={ArcsStackNavigator}
          options={{ title: t('arcs_title'), drawerIcon: drawerIcon('library-outline') }}
          listeners={drawerItemListeners('ArcsStack', 'StoryArcList')}
        />
        <Drawer.Screen
          name="CalendarsStack"
          component={CalendarsStackNavigator}
          options={{ title: t('calendar_list_title'), drawerIcon: drawerIcon('calendar-outline') }}
          listeners={drawerItemListeners('CalendarsStack', 'StoryCalendarList')}
        />
        <Drawer.Screen
          name="StatsStack"
          component={StatsStackNavigator}
          options={{ title: t('stats_title'), drawerIcon: drawerIcon('stats-chart-outline') }}
          listeners={drawerItemListeners('StatsStack', 'StatList')}
        />
        <Drawer.Screen
          name="CommentsStack"
          component={CommentsStackNavigator}
          options={{
            title: t('comments_title'),
            drawerLabel: t('comments_title'),
            drawerIcon: drawerIcon('chatbubbles-outline'),
          }}
          listeners={drawerItemListeners('CommentsStack', 'CommentsList')}
        />
        <Drawer.Screen
          name="OperationLogStack"
          component={OperationLogStackNavigator}
          options={{
            title: t('operation_logs_title'),
            drawerLabel: t('operation_logs_title'),
            drawerIcon: drawerIcon('time-outline'),
          }}
          listeners={drawerItemListeners('OperationLogStack', 'OperationLog')}
        />
        <Drawer.Screen
          name="StoryAnalysisStack"
          component={StoryAnalysisStackNavigator}
          options={{
            title: t('story_analysis_title'),
            drawerIcon: drawerIcon('analytics-outline'),
          }}
          listeners={drawerItemListeners('StoryAnalysisStack', 'StoryAnalysis')}
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
          listeners={drawerItemListeners('StoryDevicesDrawer', 'DeviceIndex')}
        />
        <Drawer.Screen
          name="HelpDrawer"
          component={HelpStackNavigator}
          options={{
            title: t('help_title'),
            drawerLabel: t('help_title'),
            drawerIcon: drawerIcon('help-circle-outline'),
          }}
          listeners={drawerItemListeners('HelpDrawer', 'HelpIndex')}
        />
        <Drawer.Screen
          name="StoryShare"
          component={StoryShareStackNavigator}
          options={{ title: t('story_share_title'), drawerIcon: drawerIcon('share-outline') }}
          listeners={drawerItemListeners('StoryShare', 'StoryShareIndex')}
        />
        <Drawer.Screen
          name="StorySettings"
          component={StorySettingsStackNavigator}
          options={{ title: t('story_settings_title'), drawerIcon: drawerIcon('settings-outline') }}
          listeners={drawerItemListeners('StorySettings', 'StorySettingsIndex')}
        />
        <Drawer.Screen
          name="StorySelection"
          // Never rendered: the entry's `drawerItemPress` is intercepted to reset the root
          // stack back to story selection, so this placeholder only satisfies the type.
          component={() => <View />}
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
