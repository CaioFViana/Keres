import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer'; // Removed DrawerItemList
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { useWindowDimensions } from 'react-native';

// Custom Drawer Content to include Sign Out button and groupings
function CustomDrawerContent({ staticRoutes, ...props }: any) {
  const { signOut } = useAuth();
  const { state, navigation, descriptors } = props; // Added navigation and descriptors

  // Helper function to render DrawerItems for a given set of routes
  const renderDrawerItems = (routesToRender: any[]) => {
    return routesToRender.map((route: any) => {
      const staticRoute = staticRoutes.find((sr: any) => sr.name === route.name);
      return (
        <DrawerItem
          key={route.key}
          label={staticRoute?.label || route.name} // Use staticRoute.label if available
          onPress={() => navigation.navigate(route.name)}
          icon={({ color, size }) => (
            <Ionicons name={staticRoute?.icon as any} size={size} color={color} />
          )}
        />
      );
    });
  };

  // Filter routes by group
  const storyDetailsRoutes = staticRoutes.filter((route: any) => route.group === 'Story Details');
  const plotRoutes = staticRoutes.filter((route: any) => route.group === 'Plot');
  const elementsRoutes = staticRoutes.filter((route: any) => route.group === 'Elements');
  const managementRoutes = staticRoutes.filter((route: any) => route.group === 'Management');
  const utilitiesRoutes = staticRoutes.filter((route: any) => route.group === 'Utilities');
  const userSettingsRoutes = staticRoutes.filter((route: any) => route.group === 'User/Settings');

  return (
    <DrawerContentScrollView {...props}>
      {/* Story Details */}
      {renderDrawerItems(storyDetailsRoutes)}

      {/* Plot Group */}
      <ThemedText style={{ fontWeight: 'bold', paddingLeft: 16, marginTop: 10 }}>Plot</ThemedText>
      {renderDrawerItems(plotRoutes)}

      {/* Elements Group */}
      <ThemedText style={{ fontWeight: 'bold', paddingLeft: 16, marginTop: 10 }}>Elements</ThemedText>
      {renderDrawerItems(elementsRoutes)}

      {/* Management Group */}
      <ThemedText style={{ fontWeight: 'bold', paddingLeft: 16, marginTop: 10 }}>Management</ThemedText>
      {renderDrawerItems(managementRoutes)}

      {/* Utilities Group */}
      <ThemedText style={{ fontWeight: 'bold', paddingLeft: 16, marginTop: 10 }}>Utilities</ThemedText>
      {renderDrawerItems(utilitiesRoutes)}

      {/* User/Settings Group */}
      <ThemedText style={{ fontWeight: 'bold', paddingLeft: 16, marginTop: 10 }}>User/Settings</ThemedText>
      {renderDrawerItems(userSettingsRoutes)}

      <DrawerItem
        label="Sign Out"
        icon={({ color, size }) => <Ionicons name="log-out" size={size} color={color} />}
        onPress={signOut}
      />
    </DrawerContentScrollView>
  );
}

const staticDrawerRoutes = [
  {
    name: '[id]',
    label: 'Story Details',
    title: 'Story Details',
    icon: 'book',
    group: 'Story Details',
  },
  {
    name: 'roteiro/chapters',
    label: 'Chapters',
    title: 'Chapters',
    icon: 'layers',
    group: 'Plot',
  },
  {
    name: 'roteiro/scenes',
    label: 'Scenes',
    title: 'Scenes',
    icon: 'videocam',
    group: 'Plot',
  },
  {
    name: 'roteiro/moments',
    label: 'Moments',
    title: 'Moments',
    icon: 'time',
    group: 'Plot',
  },
  {
    name: 'roteiro/choices',
    label: 'Choices',
    title: 'Choices',
    icon: 'git-branch',
    group: 'Plot',
  },
  {
    name: 'elements/characters',
    label: 'Characters',
    title: 'Characters',
    icon: 'people',
    group: 'Elements',
  },
  {
    name: 'elements/locations',
    label: 'Locations',
    title: 'Locations',
    icon: 'map',
    group: 'Elements',
  },
  {
    name: 'elements/world-rules',
    label: 'World Rules',
    title: 'World Rules',
    icon: 'globe',
    group: 'Elements',
  },
  {
    name: 'elements/notes',
    label: 'Notes',
    title: 'Notes',
    icon: 'document',
    group: 'Elements',
  },
  {
    name: 'gallery',
    label: 'Gallery',
    title: 'Gallery',
    icon: 'image',
    group: 'Management',
  },
  {
    name: 'suggestions',
    label: 'Suggestions',
    title: 'Suggestions',
    icon: 'bulb',
    group: 'Management',
  },
  {
    name: 'tags',
    label: 'Tags',
    title: 'Tags',
    icon: 'pricetag',
    group: 'Management',
  },
  {
    name: 'search',
    label: 'Search',
    title: 'Search',
    icon: 'search',
    group: 'Utilities',
  },
  {
    name: 'export-import',
    label: 'Export / Import',
    title: 'Export / Import',
    icon: 'swap-horizontal',
    group: 'Utilities',
  },
  {
    name: 'user-profile',
    label: 'Profile',
    title: 'User Profile',
    icon: 'person',
    group: 'User/Settings',
  },
];

export default function StoryLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Define your breakpoint for desktop

  const commonScreenOptions = {
    headerShown: true, // Show header by default for all authenticated screens
  };

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} staticRoutes={staticDrawerRoutes} />}
      screenOptions={{
        ...commonScreenOptions, // Apply common options
        drawerType: isLargeScreen ? 'permanent' : 'front', // Dynamic drawer type
      }}
    >
      {/* The main story content screen */}
      <Drawer.Screen
        name="[id]"
        options={{
          drawerLabel: 'Story Details',
          title: 'Story Details',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />

      
      
    </Drawer>
  );
}