import { Ionicons } from '@expo/vector-icons';
import { StorySchemaEntityType } from '@keres/shared';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import {
  CommonActions,
  DrawerActions,
  getFocusedRouteNameFromRoute,
  NavigationState,
  NavigatorScreenParams,
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
import ChapterDetailScreen, {
  ChapterDetailScreenParamList,
} from '../screens/narrative-elements/chapters/ChapterDetailScreen';
import ChapterFormScreen from '../screens/narrative-elements/chapters/ChapterFormScreen';
import NarrativeElementsListScreen from '../screens/narrative-elements/chapters/NarrativeElementsListScreen';
import CharacterRelationGraphScreen from '../screens/characterrelations/CharacterRelationGraphScreen';
import CharacterDetailScreen, {
  CharacterDetailScreenParamList,
} from '../screens/characters/CharacterDetailScreen';
import CharacterFormScreen from '../screens/characters/CharacterFormScreen';
import CharactersScreen from '../screens/characters/CharacterListScreen';
import ChoiceDetailScreen from '../screens/narrative-elements/choices/ChoiceDetailScreen';
import ChoiceFormScreen from '../screens/narrative-elements/choices/ChoiceFormScreen';
import ChoiceViewScreen from '../screens/narrative-elements/choices/ChoiceViewScreen';
import CommentListScreen from '../screens/comments/CommentListScreen';
import GalleryDetailScreen from '../screens/gallery/GalleryDetailScreen';
import GalleryListScreen from '../screens/gallery/GalleryListScreen';
import GlobalSearchScreen from '../screens/globalsearch/GlobalSearchScreen';
import ItemJourneyDetailScreen from '../screens/itemJourneys/ItemJourneyDetailScreen';
import ItemJourneyFormScreen from '../screens/itemJourneys/ItemJourneyFormScreen';
import ItemDetailScreen from '../screens/items/ItemDetailScreen';
import ItemFormScreen from '../screens/items/ItemFormScreen';
import ItemListScreen from '../screens/items/ItemListScreen';
import LocationDetailsScreen, {
  LocationDetailScreenParamList,
} from '../screens/locations/LocationDetailsScreen';
import LocationFormScreen from '../screens/locations/LocationFormScreen';
import LocationGraphScreen from '../screens/locations/LocationGraphScreen';
import LocationListScreen from '../screens/locations/LocationListScreen';
import MainDashboardScreen from '../screens/mainstorystack/MainDashboardScreen';
import StoryAnalysisScreen from '../screens/mainstorystack/StoryAnalysisScreen';
import StorySettingsScreen from '../screens/mainstorystack/StorySettingsScreen';
import NoteDetailScreen, { NoteDetailScreenParamList } from '../screens/notes/NoteDetailScreen';
import NoteFormScreen from '../screens/notes/NoteFormScreen';
import NotesScreen from '../screens/notes/NoteListScreen';
import OperationLogDetailScreen from '../screens/operationlog/OperationLogDetailScreen';
import OperationLogScreen from '../screens/operationlog/OperationLogListScreen';
import SceneDetailScreen from '../screens/narrative-elements/scenes/SceneDetailScreen';
import SceneFormScreen from '../screens/narrative-elements/scenes/SceneFormScreen';
import StoryTimelineScreen from '../screens/narrative-elements/timeline/StoryTimelineScreen';
import StorySchemaFieldFormScreen from '../screens/storyschema/StorySchemaFieldFormScreen';
import StorySchemaListScreen from '../screens/storyschema/StorySchemaListScreen';
import SuggestionsScreen from '../screens/suggestions/SuggestionsScreen';
import SuggestionUsageScreen from '../screens/suggestions/SuggestionUsageScreen';
import TagDetailScreen, { TagDetailScreenParamList } from '../screens/tags/TagDetailScreen';
import TagFormScreen from '../screens/tags/TagFormScreen';
import TagsScreen from '../screens/tags/TagListScreen';
import WorldRuleDetailScreen, {
  WorldRuleDetailScreenParamList,
} from '../screens/worldrules/WorldRuleDetailScreen';
import WorldRuleFormScreen from '../screens/worldrules/WorldRuleFormScreen';
import WorldRulesScreen from '../screens/worldrules/WorldRuleListScreen';
import { useHeaderBackActionStore } from '../state/headerBackActionStore';
import { useStoryStore } from '../state/storyStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import HelpStackNavigator, { HelpStackParamList } from './HelpStack';
import StatsStackNavigator, { StatsStackParamList } from './StatsStack';
import StoryDevicesStackNavigator, { StoryDevicesStackParamList } from './StoryDevicesStack';

export type MainSystemDrawerParamList = {
  MainDashboard: undefined;
  GlobalSearch: undefined;
  // Todas as pilhas abaixo aceitam `{ screen, params }` opcional pela mesma razão: cada
  // `Drawer.Screen` tem seu próprio `drawerItemPress` (ver mais abaixo) que navega
  // explicitamente para a tela de lista da pilha ao ser tocado no menu, em vez de deixar o
  // Drawer restaurar o estado aninhado como estava.
  CharactersStack: NavigatorScreenParams<CharacterStackParamList> | undefined;
  LocationsStack: NavigatorScreenParams<LocationStackParamList> | undefined;
  NarrativeElementsStack: NavigatorScreenParams<NarrativeElementsStackParamList> | undefined;
  ItemsStack: NavigatorScreenParams<ItemStackParamList> | undefined;
  TagsStack: NavigatorScreenParams<TagsStackParamList> | undefined;
  WorldRulesStack: NavigatorScreenParams<WorldRulesStackParamList> | undefined;
  NotesStack: NavigatorScreenParams<NotesStackParamList> | undefined;
  GalleryStack: NavigatorScreenParams<GalleryStackParamList> | undefined;
  Settings: undefined;
  StorySettings: { storyId: string };
  StoryAnalysis: { storyId: string };
  OperationLogStack: NavigatorScreenParams<OperationLogStackParamList> | undefined;
  CommentsStack: NavigatorScreenParams<CommentsStackParamList> | undefined;
  StorySchemaStack: NavigatorScreenParams<StorySchemaStackParamList> | undefined;
  SuggestionsStack: NavigatorScreenParams<SuggestionsStackParamList> | undefined;
  StorySelection: undefined;
  StatsDrawer: NavigatorScreenParams<StatsStackParamList>;
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
  'Tags',
  'Notes',
  'WorldRules',
  'OperationLog',
  'CommentsList',
  'StorySchemaList',
  'Suggestions',
  // As raízes dos stacks que o drawer abre direto: sem elas o header desenha uma seta de
  // voltar em cima da própria lista, que é justamente o lugar de onde não se volta.
  'StatList',
  'HelpIndex',
  'DeviceIndex',
]);

//#region Suggestions
const SuggestionsStack = createNativeStackNavigator<SuggestionsStackParamList>();

export type SuggestionsStackParamList = {
  Suggestions: undefined;
  SuggestionUsage: { type: string; value: string };
};

const SuggestionsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <SuggestionsStack.Navigator screenOptions={{ headerShown: false }}>
      <SuggestionsStack.Screen name="Suggestions" component={SuggestionsScreen} />
      <SuggestionsStack.Screen name="SuggestionUsage" component={SuggestionUsageScreen} />
    </SuggestionsStack.Navigator>
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
    <CharacterStack.Navigator screenOptions={{ headerShown: false }}>
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
    <NarrativeElementsStack.Navigator screenOptions={{ headerShown: false }}>
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
    <ItemStack.Navigator screenOptions={{ headerShown: false }}>
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
    <LocationStack.Navigator screenOptions={{ headerShown: false }}>
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
//#region Story Schema

const StorySchemaStack = createNativeStackNavigator<StorySchemaStackParamList>();

export type StorySchemaStackParamList = {
  StorySchemaList: undefined;
  StorySchemaFieldForm: { entityType: StorySchemaEntityType; fieldId?: string };
};

const StorySchemaStackNavigator = () => {
  useBackButtonHandler();
  return (
    <StorySchemaStack.Navigator screenOptions={{ headerShown: false }}>
      <StorySchemaStack.Screen name="StorySchemaList" component={StorySchemaListScreen} />
      <StorySchemaStack.Screen name="StorySchemaFieldForm" component={StorySchemaFieldFormScreen} />
    </StorySchemaStack.Navigator>
  );
};
//#endregion

/// Main Drawer
type MainDashboardScreenNavigationProp = DrawerNavigationProp<MainSystemDrawerParamList>;

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
    <>
      <Drawer.Navigator
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
            // As telas aninhadas usam headerRight para ações como criar e editar. O atalho de
            // ajuda fica no lado esquerdo para continuar visível quando essas ações substituem
            // o lado direito do header do drawer.
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
            // A história atual precisa se destacar das demais entradas do drawer, que são só
            // navegação - sem isto, o nome da história some no meio da lista como se fosse mais
            // um item igual a "Personagens" ou "Locais".
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
          }}
        />
        <Drawer.Screen
          name="CharactersStack"
          component={CharacterStackNavigator}
          options={{
            title: t('characters_title'),
            drawerLabel: t('characters_title'),
          }}
          listeners={({ navigation }) => ({
            // O comportamento padrão do Drawer, ao tocar num item, restaura o estado
            // aninhado exatamente como ele estava (é assim que abas preservam navegação -
            // é intencional na maioria dos apps). Aqui a gente quer o oposto: tocar "Personagens"
            // sempre deve levar à lista, não a onde a pilha ficou. `preventDefault` bloqueia essa
            // restauração, e navegar direto para a rota "Characters" (a raiz da pilha) faz o
            // stack navigator descartar tudo acima dela - sem depender de um evento global
            // separado torcendo para a ListScreen estar montada a tempo de escutá-lo.
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
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('NarrativeElementsStack', { screen: 'NarrativeElements' });
            },
          })}
        />
        <Drawer.Screen
          name="LocationsStack"
          component={LocationStackNavigator}
          options={{
            title: t('locations_title'),
            drawerLabel: t('locations_title'),
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
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('GalleryStack', { screen: 'GalleryList' });
            },
          })}
        />
        <Drawer.Screen
          name="StorySchemaStack"
          component={StorySchemaStackNavigator}
          options={{
            title: t('story_schema_management_title'),
            drawerLabel: t('story_schema_management_title'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('StorySchemaStack', { screen: 'StorySchemaList' });
            },
          })}
        />
        <Drawer.Screen
          name="SuggestionsStack"
          component={SuggestionsStackNavigator}
          options={{
            title: t('standard_suggestions_title'),
            drawerLabel: t('standard_suggestions_title'),
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('SuggestionsStack', { screen: 'Suggestions' });
            },
          })}
        />
        <Drawer.Screen
          name="StatsDrawer"
          component={StatsStackNavigator}
          options={{
            title: t('stats_title'),
            drawerLabel: t('stats_title'),
            // O stack continua registrado; só o item do menu some quando o sistema está desligado.
            drawerItemStyle: {
              height: selectedStory?.statSystem ? undefined : 0,
              overflow: 'hidden',
            },
          }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('StatsDrawer', { screen: 'StatList' });
            },
          })}
        />
        <Drawer.Screen
          name="CommentsStack"
          component={CommentsStackNavigator}
          options={{
            title: t('comments_title'),
            drawerLabel: t('comments_title'),
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
          options={{ title: t('story_analysis_title') }}
        />
        <Drawer.Screen
          name="StorySettings"
          component={StorySettingsScreen}
          options={{ title: t('story_settings_title') }}
        />
        <Drawer.Screen
          name="StoryDevicesDrawer"
          component={StoryDevicesStackNavigator}
          options={{
            title: t('story_devices_title'),
            drawerLabel: t('story_devices_title'),
            // A tela continua registrada quando o ajuste está desligado para que uma navegação
            // direta ou um link de ajuda não quebre; só o item do menu some.
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
          options={{ title: t('help_title'), drawerLabel: t('help_title') }}
          listeners={({ navigation }) => ({
            drawerItemPress: (e) => {
              e.preventDefault();
              navigation.navigate('HelpDrawer', { screen: 'HelpIndex' });
            },
          })}
        />
        <Drawer.Screen
          name="StorySelection"
          component={() => <View />} // A dummy component, as it won't be displayed
          options={{
            title: t('story_selection_title'),
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
    </>
  );
};

export default MainSystemNavigator;
