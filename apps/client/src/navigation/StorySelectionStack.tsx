import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerActions, NavigatorScreenParams, StackActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, TouchableOpacity } from 'react-native';
import { createStoryService, useDrizzle } from '../db';
import SettingsScreen from '../screens/enterstack/AppSettingsScreen';
import FriendshipFormScreen from '../screens/enterstack/FriendshipFormScreen';
import FriendshipListScreen from '../screens/enterstack/FriendshipListScreen';
import ServerManagementScreen from '../screens/enterstack/ServerManagementScreen';
import ServerRegistrationScreen from '../screens/enterstack/ServerRegistrationScreen';
import StoryFormScreen from '../screens/enterstack/StoryFormScreen';
import StorySelectionScreen from '../screens/enterstack/StorySelectionScreen';
import { createServerService } from '../services/ServerService';
import { ServerStoryPreview, SyncEngineService } from '../services/SyncEngineService';
import { useNotificationStore } from '../state/notificationStore';
import { useStoryListStore } from '../state/storyListStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { entityEventEmitter } from '../utils/EventEmitter'; // Import entityEventEmitter

export type StorySelectionMainStackParamList = {
  StorySelectionScreen: undefined;
  StoryForm: { storyId?: string };
};

export type ServerManagementStackParamList = {
  ServerManagement: undefined;
  ServerRegistration: { serverId?: string };
};

export type FriendshipStackParamList = {
  FriendshipList: undefined;
  FriendshipForm: { friendshipId?: string };
};

export type StorySelectionDrawerParamList = {
  StorySelectionMain: NavigatorScreenParams<StorySelectionMainStackParamList>;
  ServerManagementDrawer: NavigatorScreenParams<ServerManagementStackParamList>;
  FriendshipDrawer: NavigatorScreenParams<FriendshipStackParamList>;
  Settings: undefined;
};

const Drawer = createDrawerNavigator<StorySelectionDrawerParamList>();
const StorySelectionMainStack = createNativeStackNavigator<StorySelectionMainStackParamList>();
const ServerManagementStack = createNativeStackNavigator<ServerManagementStackParamList>();
const FriendshipStack = createNativeStackNavigator<FriendshipStackParamList>();

type StorySelectionMainDrawerNavigationProp = DrawerNavigationProp<StorySelectionDrawerParamList>;

const DrawerToggleButton = ({ navigation }: { navigation: StorySelectionMainDrawerNavigationProp }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())} style={{ marginLeft: 15 }}>
      <Ionicons name="menu" size={30} color={colors.text} />
    </TouchableOpacity>
  );
};

const StorySelectionMainStackNavigator = () => {
  const { t } = useTranslation();

  return (
    <StorySelectionMainStack.Navigator screenOptions={{
      headerShown: false, // Header is managed by the Drawer Navigator
    }}>
      <StorySelectionMainStack.Screen
        name="StorySelectionScreen"
        component={StorySelectionScreen}
        options={{
          title: t('welcome_to_story_selection'),
        }}
      />
      <StorySelectionMainStack.Screen name="StoryForm" component={StoryFormScreen} />
    </StorySelectionMainStack.Navigator>
  );
};

const ServerManagementStackNavigator = () => {
  const { t } = useTranslation();

  return (
    <ServerManagementStack.Navigator screenOptions={{
      headerShown: false, // Header is managed by the Drawer Navigator
    }}>
      <ServerManagementStack.Screen
        name="ServerManagement"
        component={ServerManagementScreen}
        options={{ headerTitle: t('manage_servers') }}
      />
      <ServerManagementStack.Screen
        name="ServerRegistration"
        component={ServerRegistrationScreen}
        options={({ route }) => ({
          headerTitle: route.params?.serverId ? t('edit_server') : t('register_new_server')
        })}
      />
    </ServerManagementStack.Navigator>
  );
};

const FriendshipStackNavigator = () => {
  const { t } = useTranslation();

  return (
    <FriendshipStack.Navigator screenOptions={{
      headerShown: false, // Header is managed by the Drawer Navigator
    }}>
      <FriendshipStack.Screen
        name="FriendshipList"
        component={FriendshipListScreen}
        options={{ headerTitle: t('manage_friendships') }}
      />
      <FriendshipStack.Screen
        name="FriendshipForm"
        component={FriendshipFormScreen}
        options={({ route }) => ({
          headerTitle: route.params?.friendshipId ? t('edit_friendship') : t('add_new_friendship')
        })}
      />
    </FriendshipStack.Navigator>
  );
};

const StorySelectionNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const drizzleClient = useDrizzle();
  const storyService = useRef(createStoryService(drizzleClient)).current;
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { fetchStories: fetchStoryList } = useStoryListStore();

  const syncStoriesWithServers = useCallback(async () => {
    if (!drizzleClient || !userId) {
      console.warn('Drizzle client or userId not available for sync. Skipping.');
      return;
    }

    SyncEngineService.getInstance().setDbInstance(drizzleClient);

    const serverService = createServerService(drizzleClient);
    const localStories = await storyService.getAllStories();
    const servers = await serverService.getAllServers();

    for (let server of servers) {
      if (!server.url) {
        console.warn(`Server ${server.name} has no URL configured. Skipping.`);
        continue;
      }

      console.log(`Checking server ${server.name} at ${server.url} for new stories...`);
      try {
        server = await serverService.refreshServerToken(server);

        const serverStoryPreviews = await SyncEngineService.getInstance().fetchServerStoryPreviews(server.url);

        const localStoryIds = new Set(localStories.map(s => s.id));
        const newStoriesOnServer = serverStoryPreviews.filter(
          (preview: ServerStoryPreview) => !localStoryIds.has(preview.storyId)
        );

        if (newStoriesOnServer.length > 0) {
          console.log(`Found ${newStoriesOnServer.length} new stories on server ${server.name}:`);
          for (const storyPreview of newStoriesOnServer) {
            console.log(`  - Story ID: ${storyPreview.storyId}, Last Operation Version: ${storyPreview.lastOperationVersion}`);
            try {
              await SyncEngineService.getInstance().downloadAndImportStory(server.id, storyPreview.storyId, server.idUser);
              console.log(`Successfully downloaded and imported story ${storyPreview.storyId}.`);
              fetchStoryList(storyService); // Refresh the story list after import
            } catch (downloadError) {
              console.error(`Failed to download and import story ${storyPreview.storyId}:`, downloadError);
              showNotification(t('failed_to_download_story') + `: ${storyPreview.storyId}`, 'error');
            }
          }
        } else {
          console.log(`No new stories found on server ${server.name}.`);
        }
      } catch (error) {
        console.error(`Error during sync with server ${server.name} at ${server.url}:`, error);
        showNotification(t('failed_to_sync_with_server') + `: ${server.name}`, 'error');
      }
    }
  }, [drizzleClient, userId, storyService, showNotification, t, fetchStoryList]);

  useEffect(() => {
    syncStoriesWithServers();
    const syncInterval = setInterval(syncStoriesWithServers, 1800000); // 30 minutes

    return () => {
      clearInterval(syncInterval);
    };
  }, [syncStoriesWithServers]);

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
        headerLeft: () => <DrawerToggleButton navigation={navigation} />,
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.text,
        drawerStyle: {
          backgroundColor: colors.surface,
        },
      })}
    >
      <Drawer.Screen
        name="StorySelectionMain"
        component={StorySelectionMainStackNavigator}
        options={{
          title: t('story_selection_title'),
          drawerLabel: t('story_selection_title'),
        }}
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('story_selection_main_navigation_reset');
          },
        })}
      />
      <Drawer.Screen
        name="ServerManagementDrawer"
        component={ServerManagementStackNavigator}
        options={{
          title: t('manage_servers'),
          drawerLabel: t('manage_servers'),
        }}
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('server_management_navigation_reset');
          },
        })}
      />
      <Drawer.Screen
        name="FriendshipDrawer"
        component={FriendshipStackNavigator}
        options={{
          title: t('manage_friendships'),
          drawerLabel: t('manage_friendships'),
        }}
        listeners={() => ({
          blur: () => {
            entityEventEmitter.emit('friendship_navigation_reset');
          },
        })}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t('settings_title'),
          drawerLabel: t('settings_title'),
        }}
      />
    </Drawer.Navigator>
  );
};

export default StorySelectionNavigator;