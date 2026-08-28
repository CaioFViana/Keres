import { Ionicons } from '@expo/vector-icons';
import type { StorySchemaEntityType } from '@keres/shared';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { NavigationState, NavigatorScreenParams } from '@react-navigation/native';
import {
  CommonActions,
  DrawerActions,
  getFocusedRouteNameFromRoute,
  StackActions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { screenHelpPage } from '../help/contextualHelp';
import { useBackButtonHandler } from '../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { MentionMatcherProvider } from '../mentions/MentionMatcherProvider';
import { MentionNavigationProvider } from '../mentions/MentionNavigationProvider';
import CharacterRelationGraphScreen from '../screens/characterrelations/CharacterRelationGraphScreen';
import type { CharacterDetailScreenParamList } from '../screens/characters/CharacterDetailScreen';
import CharacterDetailScreen from '../screens/characters/CharacterDetailScreen';
import CharacterFormScreen from '../screens/characters/CharacterFormScreen';
import CharactersScreen from '../screens/characters/CharacterListScreen';
import CommentListScreen from '../screens/comments/CommentListScreen';
import CustomizationIndexScreen from '../screens/customization/CustomizationIndexScreen';
import BoardCanvasScreen from '../screens/boards/BoardCanvasScreen';
import BoardListScreen from '../screens/boards/BoardListScreen';
import GalleryDetailScreen from '../screens/gallery/GalleryDetailScreen';
import GalleryListScreen from '../screens/gallery/GalleryListScreen';
import GlobalSearchScreen from '../screens/globalsearch/GlobalSearchScreen';
import ItemJourneyDetailScreen from '../screens/itemJourneys/ItemJourneyDetailScreen';
import ItemJourneyFormScreen from '../screens/itemJourneys/ItemJourneyFormScreen';
import ItemDetailScreen from '../screens/items/ItemDetailScreen';
import ItemFormScreen from '../screens/items/ItemFormScreen';
import ItemListScreen from '../screens/items/ItemListScreen';
import type { LocationDetailScreenParamList } from '../screens/locations/LocationDetailsScreen';
import LocationDetailsScreen from '../screens/locations/LocationDetailsScreen';
import LocationFormScreen from '../screens/locations/LocationFormScreen';
import LocationGraphScreen from '../screens/locations/LocationGraphScreen';
import LocationListScreen from '../screens/locations/LocationListScreen';
import MainDashboardScreen from '../screens/mainstorystack/MainDashboardScreen';
import StoryAnalysisScreen from '../screens/mainstorystack/StoryAnalysisScreen';
import StorySettingsScreen from '../screens/mainstorystack/StorySettingsScreen';
import type { ChapterDetailScreenParamList } from '../screens/narrative-elements/chapters/ChapterDetailScreen';
import ChapterDetailScreen from '../screens/narrative-elements/chapters/ChapterDetailScreen';
import ChapterFormScreen from '../screens/narrative-elements/chapters/ChapterFormScreen';
import NarrativeElementsListScreen from '../screens/narrative-elements/chapters/NarrativeElementsListScreen';
import ChoiceDetailScreen from '../screens/narrative-elements/choices/ChoiceDetailScreen';
import ChoiceFormScreen from '../screens/narrative-elements/choices/ChoiceFormScreen';
import ChoiceViewScreen from '../screens/narrative-elements/choices/ChoiceViewScreen';
import SceneDetailScreen from '../screens/narrative-elements/scenes/SceneDetailScreen';
import SceneFormScreen from '../screens/narrative-elements/scenes/SceneFormScreen';
import StoryTimelineScreen from '../screens/narrative-elements/timeline/StoryTimelineScreen';
import type { NoteDetailScreenParamList } from '../screens/notes/NoteDetailScreen';
import NoteDetailScreen from '../screens/notes/NoteDetailScreen';
import NoteFormScreen from '../screens/notes/NoteFormScreen';
import NotesScreen from '../screens/notes/NoteListScreen';
import OperationLogDetailScreen from '../screens/operationlog/OperationLogDetailScreen';
import OperationLogScreen from '../screens/operationlog/OperationLogListScreen';
import PlotDetailScreen from '../screens/plots/PlotDetailScreen';
import PlotFormScreen from '../screens/plots/PlotFormScreen';
import PlotListScreen from '../screens/plots/PlotListScreen';
import PlotMatrixScreen from '../screens/plots/PlotMatrixScreen';
import PlotProgressScreen from '../screens/plots/PlotProgressScreen';
import PlotReaderScreen from '../screens/plots/PlotReaderScreen';
import StatComparisonScreen from '../screens/stats/StatComparisonScreen';
import StatFormScreen from '../screens/stats/StatFormScreen';
import StatLadderScreen from '../screens/stats/StatLadderScreen';
import StatListScreen from '../screens/stats/StatListScreen';
import StatRankingScreen from '../screens/stats/StatRankingScreen';
import StoryAgendaScreen from '../screens/storycalendars/StoryAgendaScreen';
import StoryCalendarFormScreen from '../screens/storycalendars/StoryCalendarFormScreen';
import StoryCalendarListScreen from '../screens/storycalendars/StoryCalendarListScreen';
import StorySchemaFieldFormScreen from '../screens/storyschema/StorySchemaFieldFormScreen';
import StorySchemaListScreen from '../screens/storyschema/StorySchemaListScreen';
import SuggestionsScreen from '../screens/suggestions/SuggestionsScreen';
import SuggestionUsageScreen from '../screens/suggestions/SuggestionUsageScreen';
import type { TagDetailScreenParamList } from '../screens/tags/TagDetailScreen';
import TagDetailScreen from '../screens/tags/TagDetailScreen';
import TagFormScreen from '../screens/tags/TagFormScreen';
import TagsScreen from '../screens/tags/TagListScreen';
import type { WorldRuleDetailScreenParamList } from '../screens/worldrules/WorldRuleDetailScreen';
import WorldRuleDetailScreen from '../screens/worldrules/WorldRuleDetailScreen';
import WorldRuleFormScreen from '../screens/worldrules/WorldRuleFormScreen';
import WorldRulesScreen from '../screens/worldrules/WorldRuleListScreen';
import { readShowcaseRequest, showcaseInitialRoute } from '../showcase/showcaseRequest';
import { useHeaderBackActionStore } from '../state/headerBackActionStore';
import { useStoryStore } from '../state/storyStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import type { HelpStackParamList } from './HelpStack';
import HelpStackNavigator from './HelpStack';
import type { StoryDevicesStackParamList } from './StoryDevicesStack';
import StoryDevicesStackNavigator from './StoryDevicesStack';

export type MainSystemDrawerParamList = {
  MainDashboard: undefined;
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

const mainSystemStackRootScreens = new Set([
  'Characters',
  'NarrativeElements',
  'Items',
  'ItemJourneys',
  'Locations',
  'GalleryList',
  'BoardList',
  'Tags',
  'Notes',
  'WorldRules',
  'Plots',
  'OperationLog',
  'CommentsList',
  'CustomizationIndex',
  // The roots of the stacks the drawer opens directly: without them the header draws a back arrow on top
  // of the list itself, which is precisely the place there is no going back from.
  'HelpIndex',
  'DeviceIndex',
]);

//#region Suggestions
//#endregion
//#region Plots
const PlotsStack = createNativeStackNavigator<PlotsStackParamList>();
export type PlotsStackParamList = {
  Plots: undefined;
  PlotDetail: { plotId: string };
  PlotForm: { plotId?: string };
  PlotMatrix: undefined;
  PlotProgress: undefined;
  PlotReader: undefined;
};
const PlotsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <PlotsStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('PlotsStack', 'Plots')}
    >
      <PlotsStack.Screen name="Plots" component={PlotListScreen} />
      <PlotsStack.Screen name="PlotDetail" component={PlotDetailScreen} />
      <PlotsStack.Screen name="PlotForm" component={PlotFormScreen} />
      <PlotsStack.Screen name="PlotMatrix" component={PlotMatrixScreen} />
      <PlotsStack.Screen name="PlotProgress" component={PlotProgressScreen} />
      <PlotsStack.Screen name="PlotReader" component={PlotReaderScreen} />
    </PlotsStack.Navigator>
  );
};
//#endregion

//#region Character

const CharacterStack = createNativeStackNavigator<CharacterStackParamList>();

export type CharacterStackParamList = {
  Characters: undefined;
  CharacterDetail: CharacterDetailScreenParamList['CharacterDetail'];
  CharacterForm: { characterId?: string };
  CharacterRelationView: undefined;
};

const CharacterStackNavigator = () => {
  useBackButtonHandler();
  return (
    <CharacterStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('CharactersStack', 'Characters')}
    >
      <CharacterStack.Screen name="Characters" component={CharactersScreen} />
      <CharacterStack.Screen name="CharacterDetail" component={CharacterDetailScreen} />
      <CharacterStack.Screen name="CharacterForm" component={CharacterFormScreen} />
      <CharacterStack.Screen
        name="CharacterRelationView"
        component={CharacterRelationGraphScreen}
      />
    </CharacterStack.Navigator>
  );
};
//#endregion
//#region Narrative elements

const NarrativeElementsStack = createNativeStackNavigator<NarrativeElementsStackParamList>();

export type NarrativeElementsStackParamList = {
  NarrativeElements: undefined;
  ChapterDetail: ChapterDetailScreenParamList['ChapterDetail'];
  ChapterForm: { chapterId?: string };
  SceneDetail: { sceneId: string };
  SceneForm: { sceneId?: string; chapterId?: string };
  ChoiceDetail: { choiceId: string };
  ChoiceForm: { choiceId?: string; sceneId?: string };
  ChoiceView: undefined;
  StoryTimeline: undefined;
};

const NarrativeElementsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <NarrativeElementsStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('NarrativeElementsStack', 'NarrativeElements')}
    >
      <NarrativeElementsStack.Screen
        name="NarrativeElements"
        component={NarrativeElementsListScreen}
      />
      <NarrativeElementsStack.Screen name="ChapterDetail" component={ChapterDetailScreen} />
      <NarrativeElementsStack.Screen name="ChapterForm" component={ChapterFormScreen} />
      <NarrativeElementsStack.Screen name="SceneDetail" component={SceneDetailScreen} />
      <NarrativeElementsStack.Screen name="SceneForm" component={SceneFormScreen} />
      <NarrativeElementsStack.Screen name="ChoiceDetail" component={ChoiceDetailScreen} />
      <NarrativeElementsStack.Screen name="ChoiceForm" component={ChoiceFormScreen} />
      <NarrativeElementsStack.Screen name="ChoiceView" component={ChoiceViewScreen} />
      <NarrativeElementsStack.Screen name="StoryTimeline" component={StoryTimelineScreen} />
    </NarrativeElementsStack.Navigator>
  );
};
//#endregion
//#region Item

const ItemStack = createNativeStackNavigator<ItemStackParamList>();

export type ItemDetailScreenParamList = {
  ItemDetail: { itemId: string };
};

export type ItemStackParamList = {
  Items: undefined;
  ItemDetail: ItemDetailScreenParamList['ItemDetail'];
  ItemForm: { itemId?: string };
  ItemJourneyDetail: { itemJourneyId: string };
  ItemJourneyForm: { itemJourneyId?: string; itemId?: string };
};

const ItemStackNavigator = () => {
  useBackButtonHandler();
  return (
    <ItemStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('ItemsStack', 'Items')}
    >
      <ItemStack.Screen name="Items" component={ItemListScreen} />
      <ItemStack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <ItemStack.Screen name="ItemForm" component={ItemFormScreen} />
      <ItemStack.Screen name="ItemJourneyDetail" component={ItemJourneyDetailScreen} />
      <ItemStack.Screen name="ItemJourneyForm" component={ItemJourneyFormScreen} />
    </ItemStack.Navigator>
  );
};
//#endregion
//#region Location

const LocationStack = createNativeStackNavigator<LocationStackParamList>();

export type LocationStackParamList = {
  Locations: undefined;
  LocationDetail: LocationDetailScreenParamList['LocationDetail'];
  LocationForm: { locationId?: string };
  LocationView: undefined;
};

const LocationStackNavigator = () => {
  useBackButtonHandler();
  return (
    <LocationStack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={showcaseInitialRoute('LocationsStack', 'Locations')}
    >
      <LocationStack.Screen name="Locations" component={LocationListScreen} />
      <LocationStack.Screen name="LocationDetail" component={LocationDetailsScreen} />
      <LocationStack.Screen name="LocationForm" component={LocationFormScreen} />
      <LocationStack.Screen name="LocationView" component={LocationGraphScreen} />
    </LocationStack.Navigator>
  );
};
//#endregion
//#region Gallery

const GalleryStack = createNativeStackNavigator<GalleryStackParamList>();

export type GalleryStackParamList = {
  GalleryList: undefined;
  GalleryDetail: { galleryId: string };
};

const GalleryStackNavigator = () => {
  useBackButtonHandler();
  return (
    <GalleryStack.Navigator screenOptions={{ headerShown: false }}>
      <GalleryStack.Screen name="GalleryList" component={GalleryListScreen} />
      <GalleryStack.Screen name="GalleryDetail" component={GalleryDetailScreen} />
    </GalleryStack.Navigator>
  );
};
//#endregion
//#region Boards

const BoardsStack = createNativeStackNavigator<BoardStackParamList>();

export type BoardStackParamList = {
  BoardList: undefined;
  BoardCanvas: { boardId: string };
};

const BoardsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <BoardsStack.Navigator screenOptions={{ headerShown: false }}>
      <BoardsStack.Screen name="BoardList" component={BoardListScreen} />
      <BoardsStack.Screen name="BoardCanvas" component={BoardCanvasScreen} />
    </BoardsStack.Navigator>
  );
};
//#endregion
//#region Tags

const TagsStack = createNativeStackNavigator<TagsStackParamList>();

export type TagsStackParamList = {
  Tags: undefined;
  TagDetail: TagDetailScreenParamList['TagDetail'];
  TagForm: { tagId?: string };
};

const TagStackNavigator = () => {
  useBackButtonHandler();
  return (
    <TagsStack.Navigator screenOptions={{ headerShown: false }}>
      <TagsStack.Screen name="Tags" component={TagsScreen} />
      <TagsStack.Screen name="TagDetail" component={TagDetailScreen} />
      <TagsStack.Screen name="TagForm" component={TagFormScreen} />
    </TagsStack.Navigator>
  );
};
//#endregion
//#region Notes

const NotesStack = createNativeStackNavigator<NotesStackParamList>();

export type NotesStackParamList = {
  Notes: undefined;
  NoteDetail: NoteDetailScreenParamList['NoteDetail'];
  NoteForm: { noteId?: string };
};

const NoteStackNavigator = () => {
  useBackButtonHandler();
  return (
    <NotesStack.Navigator screenOptions={{ headerShown: false }}>
      <NotesStack.Screen name="Notes" component={NotesScreen} />
      <NotesStack.Screen name="NoteDetail" component={NoteDetailScreen} />
      <NotesStack.Screen name="NoteForm" component={NoteFormScreen} />
    </NotesStack.Navigator>
  );
};
//#endregion
//#region WorldRules

const WorldRulesStack = createNativeStackNavigator<WorldRulesStackParamList>();

export type WorldRulesStackParamList = {
  WorldRules: undefined;
  WorldRuleDetail: WorldRuleDetailScreenParamList['WorldRuleDetail'];
  WorldRuleForm: { worldRuleId?: string };
};

const WorldRuleStackNavigator = () => {
  useBackButtonHandler();
  return (
    <WorldRulesStack.Navigator screenOptions={{ headerShown: false }}>
      <WorldRulesStack.Screen name="WorldRules" component={WorldRulesScreen} />
      <WorldRulesStack.Screen name="WorldRuleDetail" component={WorldRuleDetailScreen} />
      <WorldRulesStack.Screen name="WorldRuleForm" component={WorldRuleFormScreen} />
    </WorldRulesStack.Navigator>
  );
};
//#endregion
//#region Operationlog
const OperationLogStack = createNativeStackNavigator<OperationLogStackParamList>();

export type OperationLogStackParamList = {
  OperationLog: undefined;
  OperationLogDetail: { logId: string };
};

const OperationLogStackNavigator = () => {
  useBackButtonHandler();
  return (
    <OperationLogStack.Navigator screenOptions={{ headerShown: false }}>
      <OperationLogStack.Screen name="OperationLog" component={OperationLogScreen} />
      <OperationLogStack.Screen name="OperationLogDetail" component={OperationLogDetailScreen} />
    </OperationLogStack.Navigator>
  );
};
//#endregion
//#region Comments

const CommentsStack = createNativeStackNavigator<CommentsStackParamList>();

export type CommentsStackParamList = {
  CommentsList: undefined;
};

const CommentsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <CommentsStack.Navigator screenOptions={{ headerShown: false }}>
      <CommentsStack.Screen name="CommentsList" component={CommentListScreen} />
    </CommentsStack.Navigator>
  );
};
//#endregion
//#region Customization

const CustomizationStack = createNativeStackNavigator<CustomizationStackParamList>();

/**
 * Everything a writer shapes once and then works inside: the story's calendars, its custom fields,
 * its suggestion catalogues and its stat system.
 *
 * These were four drawer entries. Each was reached rarely and each sat between things reached
 * constantly, so the drawer read as a list of everything rather than a list of places to write.
 * They are one stack rather than four nested ones because a nested navigator per area would put a
 * second back stack between the index and the screens for no gain - the areas share no state and
 * never navigate into each other.
 */
export type CustomizationStackParamList = {
  CustomizationIndex: undefined;
  StoryCalendarList: undefined;
  StoryCalendarForm: { calendarId?: string };
  StoryAgenda: undefined;
  StorySchemaList: undefined;
  StorySchemaFieldForm: { entityType: StorySchemaEntityType; fieldId?: string };
  Suggestions: undefined;
  SuggestionUsage: { type: string; value: string };
  StatList: undefined;
  StatForm: { statId?: string } | undefined;
  /** An absent `statId` = the story's default ladder. */
  StatLadder: { statId?: string } | undefined;
  StatComparison: { characterId?: string; modeId?: string } | undefined;
  StatRanking: { statId?: string } | undefined;
};

const CustomizationStackNavigator = () => {
  useBackButtonHandler();
  return (
    <CustomizationStack.Navigator screenOptions={{ headerShown: false }}>
      <CustomizationStack.Screen name="CustomizationIndex" component={CustomizationIndexScreen} />
      <CustomizationStack.Screen name="StoryCalendarList" component={StoryCalendarListScreen} />
      <CustomizationStack.Screen name="StoryCalendarForm" component={StoryCalendarFormScreen} />
      <CustomizationStack.Screen name="StoryAgenda" component={StoryAgendaScreen} />
      <CustomizationStack.Screen name="StorySchemaList" component={StorySchemaListScreen} />
      <CustomizationStack.Screen
        name="StorySchemaFieldForm"
        component={StorySchemaFieldFormScreen}
      />
      <CustomizationStack.Screen name="Suggestions" component={SuggestionsScreen} />
      <CustomizationStack.Screen name="SuggestionUsage" component={SuggestionUsageScreen} />
      <CustomizationStack.Screen name="StatList" component={StatListScreen} />
      <CustomizationStack.Screen name="StatForm" component={StatFormScreen} />
      <CustomizationStack.Screen name="StatLadder" component={StatLadderScreen} />
      <CustomizationStack.Screen name="StatComparison" component={StatComparisonScreen} />
      <CustomizationStack.Screen name="StatRanking" component={StatRankingScreen} />
    </CustomizationStack.Navigator>
  );
};
//#endregion

/// Main Drawer
type MainDashboardScreenNavigationProp = DrawerNavigationProp<MainSystemDrawerParamList>;

const drawerIcon = (name: keyof typeof Ionicons.glyphMap) =>
  function DrawerMenuIcon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

const DrawerToggleButton = ({ navigation }: { navigation: MainDashboardScreenNavigationProp }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      style={{ marginLeft: 15 }}
    >
      <Ionicons name="menu" size={30} color={colors.text} />
    </TouchableOpacity>
  );
};

const MainSystemNavigator = () => {
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const { t } = useTranslation();
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
                      ) : !isWide ? (
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
            title: t('characters_title'),
            drawerLabel: t('characters_title'),
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
        {selectedStory?.type === 'linear' && (
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
        )}
        <Drawer.Screen
          name="LocationsStack"
          component={LocationStackNavigator}
          options={{
            title: t('locations_title'),
            drawerLabel: t('locations_title'),
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
            title: t('items_title'),
            drawerLabel: t('items_title'),
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
            title: t('world_rules_title'),
            drawerLabel: t('world_rules_title'),
            drawerIcon: drawerIcon('globe-outline'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('WorldRulesStack', { screen: 'WorldRules' });
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
            drawerIcon: drawerIcon('easel-outline'),
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
          options={{ title: t('story_analysis_title'), drawerIcon: drawerIcon('analytics-outline') }}
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
    </MentionMatcherProvider>
  );
};

export default MainSystemNavigator;
