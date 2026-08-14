import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator, DrawerNavigationProp } from '@react-navigation/drawer';
import {
  DrawerActions,
  getFocusedRouteNameFromRoute,
  NavigatorScreenParams,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View } from 'react-native';
import NavigationBackButton from '../components/common/navigation/NavigationBackButton/NavigationBackButton';
import ResizableDrawerContent, {
  DRAWER_MIN_WIDTH,
  useResizableDrawerWidth,
} from '../components/common/navigation/ResizableDrawerContent/ResizableDrawerContent';
import { screenHelpPage } from '../help/contextualHelp';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import SettingsScreen from '../screens/enterstack/AppSettingsScreen';
import ChangePasswordScreen from '../screens/enterstack/ChangePasswordScreen';
import FriendDetailScreen from '../screens/enterstack/FriendDetailScreen';
import FriendshipFormScreen from '../screens/enterstack/FriendshipFormScreen';
import FriendshipListScreen from '../screens/enterstack/FriendshipListScreen';
import ImportExportScreen from '../screens/enterstack/ImportExportScreen';
import MyProfileScreen from '../screens/enterstack/MyProfileScreen';
import ServerManagementScreen from '../screens/enterstack/ServerManagementScreen';
import ServerRegistrationScreen from '../screens/enterstack/ServerRegistrationScreen';
import StoryFormScreen from '../screens/enterstack/StoryFormScreen';
import StorySelectionScreen from '../screens/enterstack/StorySelectionScreen';
import ExampleStoriesScreen from '../screens/examplestories/ExampleStoriesScreen';
import { useTheme } from '../theme';
import HelpStackNavigator, { HelpStackParamList } from './HelpStack';

export type StorySelectionMainStackParamList = {
  StorySelectionScreen: undefined;
  StoryForm: { storyId?: string };
};

export type ServerManagementStackParamList = {
  ServerManagement: undefined;
  ServerRegistration: { serverId?: string };
  MyProfile: { serverId: string };
  ChangePassword: { serverId: string };
};

export type FriendshipStackParamList = {
  FriendshipList: undefined;
  FriendshipForm: undefined;
  FriendDetail: { friendshipId: string };
};

export type StorySelectionDrawerParamList = {
  StorySelectionMain: NavigatorScreenParams<StorySelectionMainStackParamList>;
  ServerManagementDrawer: NavigatorScreenParams<ServerManagementStackParamList>;
  FriendshipDrawer: NavigatorScreenParams<FriendshipStackParamList>;
  ImportExport: undefined;
  ExampleStories: undefined;
  Settings: undefined;
  HelpDrawer: NavigatorScreenParams<HelpStackParamList>;
};

const Drawer = createDrawerNavigator<StorySelectionDrawerParamList>();
const StorySelectionMainStack = createNativeStackNavigator<StorySelectionMainStackParamList>();
const ServerManagementStack = createNativeStackNavigator<ServerManagementStackParamList>();
const FriendshipStack = createNativeStackNavigator<FriendshipStackParamList>();

type StorySelectionMainDrawerNavigationProp = DrawerNavigationProp<StorySelectionDrawerParamList>;

const DrawerToggleButton = ({
  navigation,
}: {
  navigation: StorySelectionMainDrawerNavigationProp;
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
      style={{ marginLeft: 15 }}
    >
      <Ionicons name="menu" size={30} color={colors.text} />
    </TouchableOpacity>
  );
};

const StorySelectionMainStackNavigator = () => {
  const { t } = useTranslation();

  return (
    <StorySelectionMainStack.Navigator
      screenOptions={{
        headerShown: false, // Header is managed by the Drawer Navigator
      }}
    >
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
    <ServerManagementStack.Navigator
      screenOptions={{
        headerShown: false, // Header is managed by the Drawer Navigator
      }}
    >
      <ServerManagementStack.Screen
        name="ServerManagement"
        component={ServerManagementScreen}
        options={{ headerTitle: t('manage_servers') }}
      />
      <ServerManagementStack.Screen
        name="ServerRegistration"
        component={ServerRegistrationScreen}
        options={({ route }) => ({
          headerTitle: route.params?.serverId ? t('edit_server') : t('register_new_server'),
        })}
      />
      <ServerManagementStack.Screen
        name="MyProfile"
        component={MyProfileScreen}
        options={{ headerTitle: t('my_profile_title') }}
      />
      <ServerManagementStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ headerTitle: t('change_password_title') }}
      />
    </ServerManagementStack.Navigator>
  );
};

const FriendshipStackNavigator = () => {
  const { t } = useTranslation();

  return (
    <FriendshipStack.Navigator
      screenOptions={{
        headerShown: false, // Header is managed by the Drawer Navigator
      }}
    >
      <FriendshipStack.Screen
        name="FriendshipList"
        component={FriendshipListScreen}
        options={{ headerTitle: t('manage_friendships') }}
      />
      <FriendshipStack.Screen
        name="FriendshipForm"
        component={FriendshipFormScreen}
        options={{ headerTitle: t('add_new_friendship') }}
      />
      <FriendshipStack.Screen
        name="FriendDetail"
        component={FriendDetailScreen}
        options={{ headerTitle: t('friend_detail_title') }}
      />
    </FriendshipStack.Navigator>
  );
};

const StorySelectionNavigator = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isCompact, isWide, width: viewportWidth } = useResponsiveLayout();
  const { drawerWidth, setDrawerWidth, maximumWidth } = useResizableDrawerWidth(viewportWidth);
  const compactDrawerWidth = Math.ceil(viewportWidth * 0.6);

  return (
    <Drawer.Navigator
      defaultStatus={isWide ? 'open' : 'closed'}
      drawerContent={(props) => (
        <ResizableDrawerContent
          {...props}
          drawerWidth={drawerWidth}
          maximumWidth={maximumWidth}
          onDrawerWidthChange={setDrawerWidth}
          resizable={!isCompact}
        />
      )}
      screenOptions={({ navigation, route }) => {
        const activeRouteName = getFocusedRouteNameFromRoute(route) ?? route.name;
        const helpPageId = screenHelpPage[activeRouteName];
        const isHelpPage = activeRouteName === 'HelpPage';

        return {
          headerShown: true,
          headerStatusBarHeight: 0,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.text,
          // Subtelas podem ocupar headerRight com ações próprias; manter a ajuda à esquerda
          // garante que o atalho contextual não desapareça em formulários e detalhes.
          headerLeft: isHelpPage
            ? () => (
                <NavigationBackButton
                  onPress={() => navigation.navigate('HelpDrawer', { screen: 'HelpIndex' })}
                />
              )
            : !isWide || helpPageId
              ? () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {!isWide ? <DrawerToggleButton navigation={navigation} /> : null}
                    {helpPageId ? (
                      <TouchableOpacity
                        onPress={() =>
                          navigation.navigate('HelpDrawer', {
                            screen: 'HelpPage',
                            params: { pageId: helpPageId },
                          })
                        }
                        style={{ marginLeft: isWide ? 15 : 8 }}
                        accessibilityLabel={t('help_title')}
                      >
                        <Ionicons name="help-circle-outline" size={26} color={colors.text} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )
              : () => null,
          headerRight: undefined,
          drawerActiveTintColor: colors.primary,
          drawerInactiveTintColor: colors.text,
          drawerType: isWide ? 'permanent' : 'front',
          swipeEnabled: !isWide,
          drawerStyle: {
            backgroundColor: colors.surface,
            minWidth: isCompact ? compactDrawerWidth : DRAWER_MIN_WIDTH,
            width: isCompact ? compactDrawerWidth : drawerWidth,
          },
        };
      }}
    >
      <Drawer.Screen
        name="StorySelectionMain"
        component={StorySelectionMainStackNavigator}
        options={{
          title: t('story_selection_title'),
          drawerLabel: t('story_selection_title'),
        }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('StorySelectionMain', { screen: 'StorySelectionScreen' });
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
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('ServerManagementDrawer', { screen: 'ServerManagement' });
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
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('FriendshipDrawer', { screen: 'FriendshipList' });
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
      {/*
        Mesmo raciocínio do Import/Export logo acima: instalar um exemplo cria uma história
        nova, então não depende de (nem pertence ao menu de) uma história já aberta.
      */}
      <Drawer.Screen
        name="ExampleStories"
        component={ExampleStoriesScreen}
        options={{
          title: t('examples_title'),
          drawerLabel: t('examples_title'),
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
      <Drawer.Screen
        name="HelpDrawer"
        component={HelpStackNavigator}
        options={{ title: t('help_title'), drawerLabel: t('help_title') }}
        listeners={({ navigation }) => ({
          drawerItemPress: (e) => {
            e.preventDefault();
            navigation.navigate('HelpDrawer', { screen: 'HelpIndex' });
          },
        })}
      />
    </Drawer.Navigator>
  );
};

export default StorySelectionNavigator;
