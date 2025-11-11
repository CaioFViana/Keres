import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MainDashboardScreen from '../screens/MainDashboardScreen';
import ListingScreen from '../screens/common/ListingScreen';
import DetailScreen from '../screens/common/DetailScreen';
import GalleryScreen from '../screens/GalleryScreen';

import ImportExportScreen from '../screens/ImportExportScreen';
import CharacterRelationsScreen from '../screens/CharacterRelationsScreen';
import ChoicesScreen from '../screens/ChoicesScreen';

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

const MainSystemNavigator = () => {
  return (
    <Drawer.Navigator screenOptions={{ headerShown: false }}>
      <Drawer.Screen name="MainDashboard" component={MainDashboardScreen} />
      <Drawer.Screen name="Characters" component={ListingDetailStack} initialParams={{ entityType: 'Characters' }} />
      <Drawer.Screen name="Locations" component={ListingDetailStack} initialParams={{ entityType: 'Locations' }} />
      <Drawer.Screen name="Chapters" component={ListingDetailStack} initialParams={{ entityType: 'Chapters' }} />
      <Drawer.Screen name="Scenes" component={ListingDetailStack} initialParams={{ entityType: 'Scenes' }} />
      <Drawer.Screen name="Tags" component={ListingDetailStack} initialParams={{ entityType: 'Tags' }} />
      <Drawer.Screen name="WorldRules" component={ListingDetailStack} initialParams={{ entityType: 'WorldRules' }} />
      <Drawer.Screen name="Notes" component={ListingDetailStack} initialParams={{ entityType: 'Notes' }} />
      <Drawer.Screen name="Gallery" component={GalleryScreen} />
      <Drawer.Screen name="CharacterRelations" component={CharacterRelationsScreen} />
      <Drawer.Screen name="Choices" component={ChoicesScreen} />
      <Drawer.Screen name="StorySettings" component={StorySettingsScreen} />
      <Drawer.Screen name="ImportExport" component={ImportExportScreen} />
    </Drawer.Navigator>
  );
};

export default MainSystemNavigator;
