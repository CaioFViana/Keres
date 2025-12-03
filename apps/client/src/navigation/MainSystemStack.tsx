import React from 'react';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, RouteProp, DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

import MainDashboardScreen from '../screens/MainDashboardScreen';
import ListingScreen from '../screens/common/ListingScreen';
import DetailScreen from '../screens/common/DetailScreen';
import GalleryScreen from '../screens/GalleryScreen';

import ImportExportScreen from '../screens/ImportExportScreen';
import CharacterRelationsScreen from '../screens/CharacterRelationsScreen';
import ChoicesScreen from '../screens/ChoicesScreen';
import StorySettingsScreen from '../screens/StorySettingsScreen';
import { useTheme } from '../theme';
import { useStoryStore } from '../state/storyStore';

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
        options={{ title: selectedStory?.title || 'Dashboard' }}
      />
      <Drawer.Screen name="Characters" component={ListingDetailStack} initialParams={{ entityType: 'Characters' }} options={{ title: 'Characters' }} />
      <Drawer.Screen name="Locations" component={ListingDetailStack} initialParams={{ entityType: 'Locations' }} options={{ title: 'Locations' }} />
      <Drawer.Screen name="Chapters" component={ListingDetailStack} initialParams={{ entityType: 'Chapters' }} options={{ title: 'Chapters' }} />
      <Drawer.Screen name="Scenes" component={ListingDetailStack} initialParams={{ entityType: 'Scenes' }} options={{ title: 'Scenes' }} />
      <Drawer.Screen name="Tags" component={ListingDetailStack} initialParams={{ entityType: 'Tags' }} options={{ title: 'Tags' }} />
      <Drawer.Screen name="WorldRules" component={ListingDetailStack} initialParams={{ entityType: 'WorldRules' }} options={{ title: 'World Rules' }} />
      <Drawer.Screen name="Notes" component={ListingDetailStack} initialParams={{ entityType: 'Notes' }} options={{ title: 'Notes' }} />
      <Drawer.Screen name="Gallery" component={GalleryScreen} options={{ title: 'Gallery' }} />
      <Drawer.Screen name="CharacterRelations" component={CharacterRelationsScreen} options={{ title: 'Character Relations' }} />
      <Drawer.Screen name="Choices" component={ChoicesScreen} options={{ title: 'Choices' }} />
      <Drawer.Screen name="StorySettings" component={StorySettingsScreen} options={{ title: 'Story Settings' }} />
      <Drawer.Screen name="ImportExport" component={ImportExportScreen} options={{ title: 'Import/Export' }} />
    </Drawer.Navigator>
  );
};

export default MainSystemNavigator;
