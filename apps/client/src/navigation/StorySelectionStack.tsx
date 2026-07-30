import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerActions, NavigatorScreenParams } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';
import SettingsScreen from '../screens/enterstack/AppSettingsScreen';
import FriendshipFormScreen from '../screens/enterstack/FriendshipFormScreen';
import FriendshipListScreen from '../screens/enterstack/FriendshipListScreen';
import ImportExportScreen from '../screens/enterstack/ImportExportScreen';
import ServerManagementScreen from '../screens/enterstack/ServerManagementScreen';
import ServerRegistrationScreen from '../screens/enterstack/ServerRegistrationScreen';
import StoryFormScreen from '../screens/enterstack/StoryFormScreen';
import StorySelectionScreen from '../screens/enterstack/StorySelectionScreen';
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
  ImportExport: undefined;
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
      {/*
        Import/export vive no menu principal, e não no menu de uma história: importar cria
        uma história nova (não existe história ativa nesse momento) e exportar deve poder
        alcançar qualquer uma das histórias, não só a que estiver aberta.
      */}
      <Drawer.Screen
        name="ImportExport"
        component={ImportExportScreen}
        options={{
          title: t('import_export_title'),
          drawerLabel: t('import_export_title'),
        }}
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