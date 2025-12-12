import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { CommonActions, DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';

import { useBackButtonHandler } from '../hooks/useBackButtonHandler';
import CharacterDetailScreen, { CharacterDetailScreenParamList } from '../screens/CharacterDetailScreen';
import CharacterFormScreen from '../screens/CharacterFormScreen';
import CharacterRelationsScreen from '../screens/CharacterRelationsScreen';
import CharactersScreen from '../screens/CharactersScreen';
import ChoicesScreen from '../screens/ChoicesScreen';
import DetailScreen from '../screens/common/DetailScreen';
import ListingScreen from '../screens/common/ListingScreen';
import GalleryScreen from '../screens/GalleryScreen';
import ImportExportScreen from '../screens/ImportExportScreen';
import MainDashboardScreen from '../screens/MainDashboardScreen';
import StorySettingsScreen from '../screens/StorySettingsScreen';
import TagsScreen from '../screens/TagsScreen';
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';
import { entityEventEmitter } from '../utils/EventEmitter';

export type MainSystemDrawerParamList = {
  MainDashboard: undefined;
  CharactersStack: undefined;
  Locations: { entityType: string };
  Chapters: { entityType: string };
  Scenes: { entityType: string };
  Tags: undefined;
  WorldRules: { entityType: string };
  Notes: { entityType: string };
  Gallery: undefined;
  CharacterRelations: undefined;
  Choices: undefined;
  Settings: undefined;
  StorySettings: { storyId: string };
  ImportExport: undefined;
  StorySelection: undefined;
};

export type ListingDetailStackParamList = {
  Listing: { entityType: string };
  Detail: { entityType: string; itemId: string };
};

/// Character ----------------
const Drawer = createDrawerNavigator<MainSystemDrawerParamList>();
const Stack = createNativeStackNavigator<ListingDetailStackParamList>();
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
      <Drawer.Screen name="Locations" component={ListingDetailStack} initialParams={{ entityType: 'Locations' }} options={{ title: t('locations_title') }} />
      <Drawer.Screen name="Chapters" component={ListingDetailStack} initialParams={{ entityType: 'Chapters' }} options={{ title: t('chapters_title') }} />
      <Drawer.Screen name="Scenes" component={ListingDetailStack} initialParams={{ entityType: 'Scenes' }} options={{ title: t('scenes_title') }} />
      <Drawer.Screen name="Tags" component={TagsScreen} options={{ title: t('tags_title') }} />
      <Drawer.Screen name="WorldRules" component={ListingDetailStack} initialParams={{ entityType: 'WorldRules' }} options={{ title: t('world_rules_title') }} />
      <Drawer.Screen name="Notes" component={ListingDetailStack} initialParams={{ entityType: 'Notes' }} options={{ title: t('notes_title') }} />
      <Drawer.Screen name="Gallery" component={GalleryScreen} options={{ title: t('gallery_title') }} />
      <Drawer.Screen name="CharacterRelations" component={CharacterRelationsScreen} options={{ title: t('character_relations_title') }} />
      <Drawer.Screen name="Choices" component={ChoicesScreen} options={{ title: t('choices_title') }} />
      <Drawer.Screen name="StorySettings" component={StorySettingsScreen} options={{ title: t('story_settings_title') }} />
      <Drawer.Screen name="ImportExport" component={ImportExportScreen} options={{ title: t('import_export_title') }} />
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