import { Ionicons } from '@expo/vector-icons';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import React from 'react';
import DrawerMenuButton from '../components/common/navigation/DrawerMenuButton/DrawerMenuButton';
import type { MainSystemDrawerParamList } from './MainSystemStack';

export const mainSystemStackRootScreens = new Set([
  'Characters',
  'NarrativeElements',
  'Items',
  'ItemJourneys',
  'Locations',
  'GalleryList',
  'BoardList',
  'Tags',
  'WorldIndex',
  'Notes',
  'Plots',
  'OperationLog',
  'CommentsList',
  'CustomizationIndex',
  'HelpIndex',
  'DeviceIndex',
]);

export type MainDashboardScreenNavigationProp = DrawerNavigationProp<MainSystemDrawerParamList>;

export const drawerIcon = (name: keyof typeof Ionicons.glyphMap) =>
  function DrawerMenuIcon({ color, size }: { color: string; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

export const DrawerToggleButton = ({
  navigation,
}: {
  navigation: MainDashboardScreenNavigationProp;
}) => <DrawerMenuButton onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} />;

export const ArcContextDrawerScreen = () => {
  const navigation = useNavigation<MainDashboardScreenNavigationProp>();
  React.useEffect(() => navigation.navigate('MainDashboard'), [navigation]);
  return null;
};
