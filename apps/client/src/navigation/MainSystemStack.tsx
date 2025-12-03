import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerActions, RouteProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';

import DetailScreen from '../screens/common/DetailScreen';
import ListingScreen from '../screens/common/ListingScreen';
import GalleryScreen from '../screens/GalleryScreen';
import MainDashboardScreen from '../screens/MainDashboardScreen';

import CharacterRelationsScreen from '../screens/CharacterRelationsScreen';
import ChoicesScreen from '../screens/ChoicesScreen';
import ImportExportScreen from '../screens/ImportExportScreen';
import StorySelectionScreen from '../screens/StorySelectionScreen';
import StorySettingsScreen from '../screens/StorySettingsScreen';
import { useStoryStore } from '../state/storyStore';
import { useTheme } from '../theme';

type MainSystemDrawerParamList = {
  MainDashboard: undefined;
  Characters: { entityType: string };
  Locations: { entityType: string };
  Chapters: { entityType: string };
  Scenes: { entityType: string };
  Tags: { entityType: string };
  WorldRules: { entityType: string };
  Notes: { entityType: string };
  Gallery: undefined;
  CharacterRelations: undefined;
  Choices: undefined;
  Settings: undefined;
  StorySettings: undefined;
  ImportExport: undefined;
  StorySelection: undefined;
};

const Drawer = createDrawerNavigator<MainSystemDrawerParamList>();
const Stack = createNativeStackNavigator();

// A helper component to wrap screens that should be part of the drawer but also have their own stack navigation
const ListingDetailStack = ({ route }: any) => {
  const { entityType } = route.params;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Listing" component={ListingScreen} initialParams={{ entityType }} />
      <Stack.Screen name="Detail" component={DetailScreen} />
    </Stack.Navigator>
  );
};

type MainDashboardScreenNavigationProp = DrawerNavigationProp<MainSystemDrawerParamList, 'MainDashboard'>;
type MainDashboardScreenRouteProp = RouteProp<MainSystemDrawerParamList, 'MainDashboard'>;

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
      <Drawer.Screen name="Characters" component={ListingDetailStack} initialParams={{ entityType: 'Characters' }} options={{ title: t('characters_title') }} />
      <Drawer.Screen name="Locations" component={ListingDetailStack} initialParams={{ entityType: 'Locations' }} options={{ title: t('locations_title') }} />
      <Drawer.Screen name="Chapters" component={ListingDetailStack} initialParams={{ entityType: 'Chapters' }} options={{ title: t('chapters_title') }} />
      <Drawer.Screen name="Scenes" component={ListingDetailStack} initialParams={{ entityType: 'Scenes' }} options={{ title: t('scenes_title') }} />
      <Drawer.Screen name="Tags" component={ListingDetailStack} initialParams={{ entityType: 'Tags' }} options={{ title: t('tags_title') }} />
      <Drawer.Screen name="WorldRules" component={ListingDetailStack} initialParams={{ entityType: 'WorldRules' }} options={{ title: t('world_rules_title') }} />
      <Drawer.Screen name="Notes" component={ListingDetailStack} initialParams={{ entityType: 'Notes' }} options={{ title: t('notes_title') }} />
      <Drawer.Screen name="Gallery" component={GalleryScreen} options={{ title: t('gallery_title') }} />
      <Drawer.Screen name="CharacterRelations" component={CharacterRelationsScreen} options={{ title: t('character_relations_title') }} />
      <Drawer.Screen name="Choices" component={ChoicesScreen} options={{ title: t('choices_title') }} />
      <Drawer.Screen name="StorySettings" component={StorySettingsScreen} options={{ title: t('story_settings_title') }} />
      <Drawer.Screen name="ImportExport" component={ImportExportScreen} options={{ title: t('import_export_title') }} />
      <Drawer.Screen name="StorySelection" component={StorySelectionScreen} options={{ title: t('story_selection_title') }} />
    </Drawer.Navigator>
  );
};

export default MainSystemNavigator;
