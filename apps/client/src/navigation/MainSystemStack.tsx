import { Ionicons } from '@expo/vector-icons';
import { StorySchemaEntityType } from '@keres/shared';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { CommonActions, DrawerActions, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import GalleryMediaViewerOverlay from '@/src/components/features/gallery/GalleryManager/GalleryMediaViewerOverlay';
import ResizableDrawerContent, {
  DRAWER_MIN_WIDTH,
  useResizableDrawerWidth,
} from '../components/common/navigation/ResizableDrawerContent/ResizableDrawerContent';
import { useBackButtonHandler } from '../hooks/useBackButtonHandler';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import ChapterDetailScreen, { ChapterDetailScreenParamList } from '../screens/chapters/ChapterDetailScreen';
import ChapterFormScreen from '../screens/chapters/ChapterFormScreen';
import ChapterListScreen from '../screens/chapters/ChapterListScreen';
import CharacterRelationGraphScreen from '../screens/characterrelations/CharacterRelationGraphScreen';
import CharacterRelationsScreen from '../screens/characterrelations/CharacterRelationListScreen';
import CharacterDetailScreen, { CharacterDetailScreenParamList } from '../screens/characters/CharacterDetailScreen';
import CharacterFormScreen from '../screens/characters/CharacterFormScreen';
import CharactersScreen from '../screens/characters/CharacterListScreen';
import ChoiceDetailScreen from '../screens/choices/ChoiceDetailScreen';
import ChoiceFormScreen from '../screens/choices/ChoiceFormScreen';
import ChoiceListScreen from '../screens/choices/ChoiceListScreen';
import ChoiceViewScreen from '../screens/choices/ChoiceViewScreen';
import CommentListScreen from '../screens/comments/CommentListScreen';
import GalleryDetailScreen from '../screens/gallery/GalleryDetailScreen';
import GalleryListScreen from '../screens/gallery/GalleryListScreen';
import GlobalSearchScreen from '../screens/globalsearch/GlobalSearchScreen';
import ItemJourneyDetailScreen from '../screens/itemJourneys/ItemJourneyDetailScreen';
import ItemJourneyFormScreen from '../screens/itemJourneys/ItemJourneyFormScreen';
import ItemJourneyListScreen from '../screens/itemJourneys/ItemJourneyListScreen';
import ItemDetailScreen from '../screens/items/ItemDetailScreen';
import ItemFormScreen from '../screens/items/ItemFormScreen';
import ItemListScreen from '../screens/items/ItemListScreen';
import LocationDetailsScreen, { LocationDetailScreenParamList } from '../screens/locations/LocationDetailsScreen';
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
import SceneDetailScreen from '../screens/scenes/SceneDetailScreen';
import SceneFormScreen from '../screens/scenes/SceneFormScreen';
import SceneListScreen from '../screens/scenes/SceneListScreen';
import StorySchemaFieldFormScreen from '../screens/storyschema/StorySchemaFieldFormScreen';
import StorySchemaListScreen from '../screens/storyschema/StorySchemaListScreen';
import SuggestionsScreen from '../screens/suggestions/SuggestionsScreen';
import TagDetailScreen, { TagDetailScreenParamList } from '../screens/tags/TagDetailScreen';
import TagFormScreen from '../screens/tags/TagFormScreen';
import TagsScreen from '../screens/tags/TagListScreen';
import WorldRuleDetailScreen, { WorldRuleDetailScreenParamList } from '../screens/worldrules/WorldRuleDetailScreen';
import WorldRuleFormScreen from '../screens/worldrules/WorldRuleFormScreen';
import WorldRulesScreen from '../screens/worldrules/WorldRuleListScreen';
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';

export type MainSystemDrawerParamList = {
  MainDashboard: undefined;
  GlobalSearch: undefined;
  // Todas as pilhas abaixo aceitam `{ screen, params }` opcional pela mesma razão: cada
  // `Drawer.Screen` tem seu próprio `drawerItemPress` (ver mais abaixo) que navega
  // explicitamente para a tela de lista da pilha ao ser tocado no menu, em vez de deixar o
  // Drawer restaurar o estado aninhado como estava.
  CharactersStack: NavigatorScreenParams<CharacterStackParamList> | undefined;
  LocationsStack: NavigatorScreenParams<LocationStackParamList> | undefined;
  ChaptersStack: NavigatorScreenParams<ChapterStackParamList> | undefined;
  ScenesStack: NavigatorScreenParams<SceneStackParamList> | undefined;
  ChoicesStack: NavigatorScreenParams<ChoiceStackParamList> | undefined;
  ItemsStack: NavigatorScreenParams<ItemStackParamList> | undefined;
  ItemJourneysStack: NavigatorScreenParams<ItemJourneyStackParamList> | undefined;
  TagsStack: NavigatorScreenParams<TagsStackParamList> | undefined;
  WorldRulesStack: NavigatorScreenParams<WorldRulesStackParamList> | undefined;
  NotesStack: NavigatorScreenParams<NotesStackParamList> | undefined;
  GalleryStack: NavigatorScreenParams<GalleryStackParamList> | undefined;
  CharacterRelationsStack: NavigatorScreenParams<CharacterRelationsStackParamList> | undefined;
  Settings: undefined;
  StorySettings: { storyId: string };
  StoryAnalysis: { storyId: string };
  OperationLogStack: NavigatorScreenParams<OperationLogStackParamList> | undefined;
  CommentsStack: NavigatorScreenParams<CommentsStackParamList> | undefined;
  StorySchemaStack: NavigatorScreenParams<StorySchemaStackParamList> | undefined;
  Suggestions: undefined;
  StorySelection: undefined;
};

const Drawer = createDrawerNavigator<MainSystemDrawerParamList>();

//#region Character

const CharacterStack = createNativeStackNavigator<CharacterStackParamList>();

export type CharacterStackParamList = {
  Characters: undefined;
  CharacterDetail: CharacterDetailScreenParamList['CharacterDetail'];
  CharacterForm: { characterId?: string };
};

const CharacterStackNavigator = () => {
  useBackButtonHandler();
  return (
    <CharacterStack.Navigator screenOptions={{ headerShown: false }}>
      <CharacterStack.Screen name="Characters" component={CharactersScreen} />
      <CharacterStack.Screen name="CharacterDetail" component={CharacterDetailScreen} />
      <CharacterStack.Screen name="CharacterForm" component={CharacterFormScreen} />
    </CharacterStack.Navigator>
  );
};
//#endregion
//#region Chapter

const ChapterStack = createNativeStackNavigator<ChapterStackParamList>();

export type ChapterStackParamList = {
  Chapters: undefined;
  ChapterDetail: ChapterDetailScreenParamList['ChapterDetail'];
  ChapterForm: { chapterId?: string };
};

const ChapterStackNavigator = () => {
  useBackButtonHandler();
  return (
    <ChapterStack.Navigator screenOptions={{ headerShown: false }}>
      <ChapterStack.Screen name="Chapters" component={ChapterListScreen} />
      <ChapterStack.Screen name="ChapterDetail" component={ChapterDetailScreen} />
      <ChapterStack.Screen name="ChapterForm" component={ChapterFormScreen} />
    </ChapterStack.Navigator>
  );
};
//#endregion
//#region Scene

const SceneStack = createNativeStackNavigator<SceneStackParamList>();

export type SceneDetailScreenParamList = {
  SceneDetail: { sceneId: string };
};

export type SceneStackParamList = {
  Scenes: undefined;
  SceneDetail: SceneDetailScreenParamList['SceneDetail'];
  SceneForm: { sceneId?: string };
};

const SceneStackNavigator = () => {
  useBackButtonHandler();
  return (
    <SceneStack.Navigator screenOptions={{ headerShown: false }}>
      <SceneStack.Screen name="Scenes" component={SceneListScreen} />
      <SceneStack.Screen name="SceneDetail" component={SceneDetailScreen} />
      <SceneStack.Screen name="SceneForm" component={SceneFormScreen} />
    </SceneStack.Navigator>
  );
};
//#endregion
//#region Choice

const ChoiceStack = createNativeStackNavigator<ChoiceStackParamList>();

export type ChoiceDetailScreenParamList = {
  ChoiceDetail: { choiceId: string };
};

export type ChoiceStackParamList = {
  Choices: undefined;
  ChoiceDetail: ChoiceDetailScreenParamList['ChoiceDetail'];
  ChoiceForm: { choiceId?: string };
  ChoiceView: undefined
};

const ChoiceStackNavigator = () => {
  useBackButtonHandler();
  return (
    <ChoiceStack.Navigator screenOptions={{ headerShown: false }}>
      <ChoiceStack.Screen name="Choices" component={ChoiceListScreen} />
      <ChoiceStack.Screen name="ChoiceDetail" component={ChoiceDetailScreen} />
      <ChoiceStack.Screen name="ChoiceForm" component={ChoiceFormScreen} />
      <ChoiceStack.Screen name="ChoiceView" component={ChoiceViewScreen} />
    </ChoiceStack.Navigator>
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
};

const ItemStackNavigator = () => {
  useBackButtonHandler();
  return (
    <ItemStack.Navigator screenOptions={{ headerShown: false }}>
      <ItemStack.Screen name="Items" component={ItemListScreen} />
      <ItemStack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <ItemStack.Screen name="ItemForm" component={ItemFormScreen} />
    </ItemStack.Navigator>
  );
};
//#endregion
//#region ItemJourney
const ItemJourneyStack = createNativeStackNavigator<ItemJourneyStackParamList>();

export type ItemJourneyDetailScreenParamList = {
  ItemJourneyDetail: { itemJourneyId: string };
};

export type ItemJourneyStackParamList = {
  ItemJourneys: undefined;
  ItemJourneyDetail: ItemJourneyDetailScreenParamList['ItemJourneyDetail'];
  ItemJourneyForm: { itemJourneyId?: string; itemId?: string };
};

const ItemJourneyStackNavigator = () => {
  useBackButtonHandler();
  return (
    <ItemJourneyStack.Navigator screenOptions={{ headerShown: false }}>
      <ItemJourneyStack.Screen name="ItemJourneys" component={ItemJourneyListScreen} />
      <ItemJourneyStack.Screen name="ItemJourneyDetail" component={ItemJourneyDetailScreen} />
      <ItemJourneyStack.Screen name="ItemJourneyForm" component={ItemJourneyFormScreen} />
    </ItemJourneyStack.Navigator>
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
//#region Character Relations

const CharacterRelationsStack = createNativeStackNavigator<CharacterRelationsStackParamList>();

export type CharacterRelationsStackParamList = {
  CharacterRelations: undefined;
  CharacterRelationView: undefined;
};

const CharacterRelationsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <CharacterRelationsStack.Navigator screenOptions={{ headerShown: false }}>
      <CharacterRelationsStack.Screen name="CharacterRelations" component={CharacterRelationsScreen} />
      <CharacterRelationsStack.Screen name="CharacterRelationView" component={CharacterRelationGraphScreen} />
    </CharacterRelationsStack.Navigator>
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
    <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} style={{ marginLeft: 15 }}>
      <Ionicons name="menu" size={30} color={colors.text} />
    </TouchableOpacity>
  );
};

const MainSystemNavigator = () => {
  const { colors } = useTheme();
  const { selectedStory } = useStoryStore();
  const { t } = useTranslation();
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
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStatusBarHeight: 0,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerLeft: isWide ? () => null : () => <DrawerToggleButton navigation={navigation as MainDashboardScreenNavigationProp} />,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.text,
        drawerType: isWide ? 'permanent' : 'front',
        swipeEnabled: !isWide,
        drawerStyle: {
          backgroundColor: colors.surface,
          minWidth: isCompact ? compactDrawerWidth : DRAWER_MIN_WIDTH,
          width: isCompact ? compactDrawerWidth : drawerWidth,
        },
      })}
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
        name="ChaptersStack"
        component={ChapterStackNavigator}
        options={{
          title: t('chapters_title'),
          drawerLabel: t('chapters_title'),
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('ChaptersStack', { screen: 'Chapters' });
          },
        })}
      />
      <Drawer.Screen
        name="ScenesStack"
        component={SceneStackNavigator}
        options={{
          title: t('scenes_title'),
          drawerLabel: t('scenes_title'),
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('ScenesStack', { screen: 'Scenes' });
          },
        })}
      />
      <Drawer.Screen
        name="ChoicesStack"
        component={ChoiceStackNavigator}
        options={{
          title: t('choices_title'),
          drawerLabel: t('choices_title'),
          drawerItemStyle: {
            height: selectedStory?.type === 'linear' ? 0 : undefined, // Hide if linear
            overflow: 'hidden', // Ensure content is hidden
          },
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('ChoicesStack', { screen: 'Choices' });
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
        name="ItemJourneysStack"
        component={ItemJourneyStackNavigator}
        options={{
          title: t('item_journeys_title'),
          drawerLabel: t('item_journeys_title'),
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('ItemJourneysStack', { screen: 'ItemJourneys' });
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
        name="CharacterRelationsStack"
        component={CharacterRelationsStackNavigator}
        options={{
          title: t('character_relations_title'),
          drawerLabel: t('character_relations_title'),
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('CharacterRelationsStack', { screen: 'CharacterRelations' });
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
        name="Suggestions"
        component={SuggestionsScreen}
        options={{
          title: t('standard_suggestions_title'),
          drawerLabel: t('standard_suggestions_title'),
        }}
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
      <Drawer.Screen name="StoryAnalysis" component={StoryAnalysisScreen} options={{ title: t('story_analysis_title') }} />
      <Drawer.Screen name="StorySettings" component={StorySettingsScreen} options={{ title: t('story_settings_title') }} />
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
                })
              );
            } else {
              console.error("Could not find root stack navigation to dispatch reset action. This is unexpected.");
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'StorySelection' }],
                })
              );
            }
          },
        })}
      />
    </Drawer.Navigator>
    <GalleryMediaViewerOverlay />
    </>
  );
};

export default MainSystemNavigator;
