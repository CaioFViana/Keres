import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView, DrawerItem, DrawerItemList } from '@react-navigation/drawer';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { useWindowDimensions } from 'react-native';

// Custom Drawer Content to include Sign Out button
function CustomDrawerContent(props: any) {
  const { signOut } = useAuth();
  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <DrawerItem
        label="Sign Out"
        icon={({ color, size }) => <Ionicons name="log-out" size={size} color={color} />}
        onPress={signOut}
      />
    </DrawerContentScrollView>
  );
}

export default function StoryLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Define your breakpoint for desktop

  const commonScreenOptions = {
    headerShown: true, // Show header by default for all authenticated screens
  };

  // This layout will only be active for large screens, as per the original design intent for the drawer
  if (!isLargeScreen) {
    // For small screens, we might want a different navigation or no sidebar for story details
    // For simplicity, let's just return a Stack with the story content
    return (
      <Drawer.Screen
        name="[id]" // This will be the story content screen
        options={{
          headerShown: true,
          title: 'Story Details',
        }}
      />
    );
  }

  return (
    <Drawer drawerContent={(props) => <CustomDrawerContent {...props} />}>
      {/* The main story content screen */}
      <Drawer.Screen
        name="[id]"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Story Details',
          title: 'Story Details',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />

      {/* Roteiro */}
      <Drawer.Screen
        name="roteiro/chapters"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Chapters',
          title: 'Chapters',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="layers" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="roteiro/scenes"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Scenes',
          title: 'Scenes',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="videocam" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="roteiro/moments"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Moments',
          title: 'Moments',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="roteiro/choices"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Choices',
          title: 'Choices',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="git-branch" size={size} color={color} />
          ),
        }}
      />

      {/* Elementos */}
      <Drawer.Screen
        name="elements/characters"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Characters',
          title: 'Characters',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="elements/locations"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Locations',
          title: 'Locations',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="map" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="elements/world-rules"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'World Rules',
          title: 'World Rules',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="globe" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="elements/notes"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Notes',
          title: 'Notes',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="document" size={size} color={color} />
          ),
        }}
      />

      {/* Management */}
      <Drawer.Screen
        name="gallery"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Gallery',
          title: 'Gallery',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="image" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="suggestions"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Suggestions',
          title: 'Suggestions',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="bulb" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="tags"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Tags',
          title: 'Tags',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="pricetag" size={size} color={color} />
          ),
        }}
      />

      {/* Utilitários */}
      <Drawer.Screen
        name="search"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Search',
          title: 'Search',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="export-import"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Export / Import',
          title: 'Export / Import',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal" size={size} color={color} />
          ),
        }}
      />

      {/* Usuário/Configurações */}
      <Drawer.Screen
        name="user-profile"
        options={{
          ...commonScreenOptions,
          drawerLabel: 'Profile',
          title: 'User Profile',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  );
}
