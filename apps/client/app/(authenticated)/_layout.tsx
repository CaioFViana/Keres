import { useAuth } from '@/context/AuthContext'; // Import useAuth
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import React from 'react';
import { useWindowDimensions } from 'react-native';

export default function AuthenticatedLayout() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Define your breakpoint for desktop
  const { signOut } = useAuth(); // Get signOut function from AuthContext

  const commonScreenOptions = {
    headerShown: true, // Show header by default for all authenticated screens
  };

  if (isLargeScreen) {
    return (
      <Drawer>
        <Drawer.Screen
          name="dashboard"
          options={{
            ...commonScreenOptions,
            drawerLabel: 'Dashboard',
            title: 'Dashboard',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="stories"
          options={{
            ...commonScreenOptions,
            drawerLabel: 'Stories',
            title: 'Stories',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="book" size={size} color={color} />
            ),
          }}
        />
        <Drawer.Screen
          name="characters"
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
          name="locations"
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
          name="notes"
          options={{
            ...commonScreenOptions,
            drawerLabel: 'Notes',
            title: 'Notes',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="document" size={size} color={color} />
            ),
          }}
        />
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
          name="world-rules"
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
        <Drawer.Screen
          name="sign-out" // A dummy screen for sign out action
          options={{
            drawerLabel: 'Sign Out',
            title: 'Sign Out',
            drawerIcon: ({ color, size }) => (
              <Ionicons name="log-out" size={size} color={color} />
            ),
            headerShown: false, // Hide header for this action screen
          }}
          listeners={{
            drawerItemPress: (e) => {
              e.preventDefault(); // Prevent navigation
              signOut(); // Call signOut function
            },
          }}
        />
      </Drawer>
    );
  } else {
    return (
      <Tabs>
        <Tabs.Screen
          name="dashboard"
          options={{
            ...commonScreenOptions,
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="stories"
          options={{
            ...commonScreenOptions,
            title: 'Stories',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="characters"
          options={{
            ...commonScreenOptions,
            title: 'Characters',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="locations"
          options={{
            ...commonScreenOptions,
            title: 'Locations',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="notes"
          options={{
            ...commonScreenOptions,
            title: 'Notes',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document" size={size} color={color} />
            ),
          }}
        />
        {/* For mobile, we might not want all items in the bottom tabs.
            Consider a "More" tab or a separate settings screen.
            For now, I'll add a few key ones and then a profile/sign-out. */}
        <Tabs.Screen
          name="user-profile"
          options={{
            ...commonScreenOptions,
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="sign-out" // A dummy screen for sign out action
          options={{
            title: 'Sign Out',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="log-out" size={size} color={color} />
            ),
            headerShown: false, // Hide header for this action screen
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault(); // Prevent navigation
              signOut(); // Call signOut function
            },
          }}
        />
      </Tabs>
    );
  }
}
