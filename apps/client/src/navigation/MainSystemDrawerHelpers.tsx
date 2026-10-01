import { Ionicons } from '@expo/vector-icons';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import React from 'react';
import MapIcon from '../components/common/display/MapIcon/MapIcon';
import DrawerMenuButton from '../components/common/navigation/DrawerMenuButton/DrawerMenuButton';
import type { MainSystemDrawerParamList } from './MainSystemStack';

/**
 * Route names that count as a stack's root for header purposes. `MainSystemStack` shows
 * its nested back button only off these roots, and `drawerItemListeners` navigates each
 * drawer entry back to its root: a new stack's list screen belongs here, or the drawer
 * header will draw a back arrow on it.
 */
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

/**
 * A drawer icon from a stored icon name (plain/`ion:`/`keres:`), for the arc context
 * entry: the active arc's picked icon, or the fallback when no arc (or no icon) is set.
 */
export const drawerStoredIcon = (name: string | null | undefined, fallback: string) =>
  function DrawerStoredMenuIcon({ color, size }: { color: string; size: number }) {
    return <MapIcon name={name || fallback} size={size} color={color} />;
  };

export const DrawerToggleButton = ({
  navigation,
}: {
  navigation: MainDashboardScreenNavigationProp;
}) => <DrawerMenuButton onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} />;

/**
 * Placeholder behind the arc-picker drawer entry: it redirects straight to the dashboard
 * because the entry's `drawerItemPress` (in `MainSystemStack`) is intercepted to open the
 * picker instead - this component only renders if that interception is bypassed.
 */
export const ArcContextDrawerScreen = () => {
  const navigation = useNavigation<MainDashboardScreenNavigationProp>();
  React.useEffect(() => navigation.navigate('MainDashboard'), [navigation]);
  return null;
};
