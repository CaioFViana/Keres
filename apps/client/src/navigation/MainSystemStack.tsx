import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { CommonActions, DrawerActions, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { useBackButtonHandler } from '../hooks/useBackButtonHandler';
import CharacterRelationDetailScreen from '../screens/characterrelations/CharacterRelationDetailScreen';
import CharacterRelationFormScreen from '../screens/characterrelations/CharacterRelationFormScreen';
import CharacterRelationsScreen from '../screens/characterrelations/CharacterRelationListScreen';
import CharacterDetailScreen, { CharacterDetailScreenParamList } from '../screens/characters/CharacterDetailScreen';
import CharacterFormScreen from '../screens/characters/CharacterFormScreen';
import CharactersScreen from '../screens/characters/CharacterListScreen';
import ChapterDetailScreen, { ChapterDetailScreenParamList } from '../screens/chapters/ChapterDetailScreen';
import ChapterFormScreen from '../screens/chapters/ChapterFormScreen';
import ChapterListScreen from '../screens/chapters/ChapterListScreen';
import ChoicesScreen from '../screens/ChoicesScreen';
import DetailScreen from '../screens/common/DetailScreen';
import ListingScreen from '../screens/common/ListingScreen';
import GalleryScreen from '../screens/GalleryScreen';
import LocationDetailsScreen, { LocationDetailScreenParamList } from '../screens/locations/LocationDetailsScreen';
import LocationFormScreen from '../screens/locations/LocationFormScreen';
import LocationListScreen from '../screens/locations/LocationListScreen';
import ImportExportScreen from '../screens/mainstorystack/ImportExportScreen';
import MainDashboardScreen from '../screens/mainstorystack/MainDashboardScreen';
import StorySettingsScreen from '../screens/mainstorystack/StorySettingsScreen';
import NoteDetailScreen, { NoteDetailScreenParamList } from '../screens/notes/NoteDetailScreen';
import NoteFormScreen from '../screens/notes/NoteFormScreen';
import NotesScreen from '../screens/notes/NoteListScreen';
import OperationLogDetailScreen from '../screens/operationlog/OperationLogDetailScreen';
import OperationLogScreen from '../screens/operationlog/OperationLogListScreen';
import TagDetailScreen, { TagDetailScreenParamList } from '../screens/tags/TagDetailScreen';
import TagFormScreen from '../screens/tags/TagFormScreen';
import TagsScreen from '../screens/tags/TagListScreen';
import WorldRuleDetailScreen, { WorldRuleDetailScreenParamList } from '../screens/worldrules/WorldRuleDetailScreen';
import WorldRuleFormScreen from '../screens/worldrules/WorldRuleFormScreen';
import WorldRulesScreen from '../screens/worldrules/WorldRuleListScreen';
import SceneListScreen from '../screens/scenes/SceneListScreen';
import SceneDetailScreen from '../screens/scenes/SceneDetailScreen';
import SceneFormScreen from '../screens/scenes/SceneFormScreen';
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';
import { entityEventEmitter } from '../utils/EventEmitter';

export type MainSystemDrawerParamList = {
  MainDashboard: undefined;
  CharactersStack: undefined;
  LocationsStack: undefined;
  ChaptersStack: undefined;
  ScenesStack: undefined;
  TagsStack: undefined;
  WorldRulesStack: undefined;
  NotesStack: undefined;
  Gallery: undefined;
  CharacterRelationsStack: undefined;
  Choices: undefined;
  Settings: undefined;
  StorySettings: { storyId: string };
  ImportExport: undefined;
  OperationLogStack: NavigatorScreenParams<OperationLogStackParamList>;
  StorySelection: undefined;
};

export type ListingDetailStackParamList = {
  Listing: { entityType: string };
  Detail: { entityType: string; itemId: string };
};

const Drawer = createDrawerNavigator<MainSystemDrawerParamList>();
const Stack = createNativeStackNavigator<ListingDetailStackParamList>();
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
//#region Location

const LocationStack = createNativeStackNavigator<LocationStackParamList>();

export type LocationStackParamList = {
  Locations: undefined;
  LocationDetail: LocationDetailScreenParamList['LocationDetail'];
  LocationForm: { locationId?: string };
};

const LocationStackNavigator = () => {
  useBackButtonHandler();
  return (
    <LocationStack.Navigator screenOptions={{ headerShown: false }}>
      <LocationStack.Screen name="Locations" component={LocationListScreen} />
      <LocationStack.Screen name="LocationDetail" component={LocationDetailsScreen} />
      <LocationStack.Screen name="LocationForm" component={LocationFormScreen} />
    </LocationStack.Navigator>
  );
};
//#endregion
//#region Character Relations

const CharacterRelationsStack = createNativeStackNavigator<CharacterRelationsStackParamList>();

export type CharacterRelationDetailScreenParamList = {
  CharacterRelationDetail: { relationId: string };
};

export type CharacterRelationFormScreenParamList = {
  CharacterRelationForm: { relationId?: string };
};

export type CharacterRelationsStackParamList = {
  CharacterRelations: undefined;
  CharacterRelationDetail: CharacterRelationDetailScreenParamList['CharacterRelationDetail'];
  CharacterRelationForm: { characterRelationId?: string };
};

const CharacterRelationsStackNavigator = () => {
  useBackButtonHandler();
  return (
    <CharacterRelationsStack.Navigator screenOptions={{ headerShown: false }}>
      <CharacterRelationsStack.Screen name="CharacterRelations" component={CharacterRelationsScreen} />
      <CharacterRelationsStack.Screen name="CharacterRelationDetail" component={CharacterRelationDetailScreen} />
      <CharacterRelationsStack.Screen name="CharacterRelationForm" component={CharacterRelationFormScreen} />
    </CharacterRelationsStack.Navigator>
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

// A helper component to wrap screens that should be part of the drawer but also have their own stack navigation
const ListingDetailStack = ({ route }: any) => {
  const { entityType } = route.params;
  useBackButtonHandler();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Listing" component={ListingScreen} initialParams={{ entityType }} />
      <Stack.Screen name="Detail" component={DetailScreen} />
    </Stack.Navigator>
  );
};
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

  return (
    <Drawer.Navigator
      defaultStatus="closed"
      backBehavior="history"
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStatusBarHeight: 0,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.text,
        headerLeft: () => <DrawerToggleButton navigation={navigation as MainDashboardScreenNavigationProp} />,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.text,
        drawerStyle: {
          backgroundColor: colors.surface,
        },
      })}
    >
      <Drawer.Screen
        name="MainDashboard"
        component={MainDashboardScreen}
        options={{ title: selectedStory?.title || t('dashboard_title') }}
      />
      <Drawer.Screen
        name="CharactersStack"
        component={CharacterStackNavigator}
        options={{
          title: t('characters_title'),
          drawerLabel: t('characters_title'),
        }}
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('character_navigation_reset');
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
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('location_navigation_reset');
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
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('chapter_navigation_reset');
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
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('scene_navigation_reset');
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
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('tag_navigation_reset');
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
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('worldrule_navigation_reset');
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
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('note_navigation_reset');
          },
        })}
      />
      <Drawer.Screen name="Gallery" component={GalleryScreen} options={{ title: t('gallery_title') }} />
      <Drawer.Screen
        name="CharacterRelationsStack"
        component={CharacterRelationsStackNavigator}
        options={{
          title: t('character_relations_title'),
          drawerLabel: t('character_relations_title'),
        }}
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('character_relation_navigation_reset');
          },
        })}
      />
      <Drawer.Screen name="Choices" component={ChoicesScreen} options={{ title: t('choices_title') }} />
      <Drawer.Screen
        name="OperationLogStack"
        component={OperationLogStackNavigator}
        options={{
          title: t('operation_logs_title'),
          drawerLabel: t('operation_logs_title'),
        }}
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('operation_logs_navigation_reset');
          },
        })}
      />
      <Drawer.Screen name="ImportExport" component={ImportExportScreen} options={{ title: t('import_export_title') }} />
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
  );
};

export default MainSystemNavigator;