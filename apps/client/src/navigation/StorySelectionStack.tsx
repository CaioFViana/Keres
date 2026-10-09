import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { NavigationState, NavigatorScreenParams } from '@react-navigation/native';
import { StackActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import FriendshipDrawerIcon from '../components/features/messages/FriendshipDrawerIcon';
import ServerDrawerIcon from '../components/features/messages/ServerDrawerIcon';
import SelectionDrawerMenu from '../components/common/navigation/SelectionDrawerMenu/SelectionDrawerMenu';
import ResizableDrawerContent from '../components/common/navigation/ResizableDrawerContent/ResizableDrawerContent';
import ShippedPacksInstallerOverlay from '@/src/components/features/packs/ShippedPacksInstallerOverlay';
import { isServerless } from '../utils/clientFlavor';
import SettingsScreen from '../screens/enterstack/AppSettingsScreen';
import ChangePasswordScreen from '../screens/enterstack/ChangePasswordScreen';
import CreditsScreen from '../screens/enterstack/CreditsScreen';
import FriendDetailScreen from '../screens/enterstack/FriendDetailScreen';
import FriendshipFormScreen from '../screens/enterstack/FriendshipFormScreen';
import ConversationScreen from '../screens/enterstack/ConversationScreen';
import FriendshipListScreen from '../screens/enterstack/FriendshipListScreen';
import MessageInboxScreen from '../screens/enterstack/MessageInboxScreen';
import ImportStoryScreen from '../screens/enterstack/ImportStoryScreen';
import PackBrowseScreen from '../screens/packs/PackBrowseScreen';
import PackFormScreen from '../screens/packs/PackFormScreen';
import PackListScreen from '../screens/packs/PackListScreen';
import ShippedPacksScreen from '../screens/packs/ShippedPacksScreen';
import MyProfileScreen from '../screens/enterstack/MyProfileScreen';
import ServerDetailScreen from '../screens/enterstack/ServerDetailScreen';
import ServerManagementScreen from '../screens/enterstack/ServerManagementScreen';
import ServerPaymentHistoryScreen from '../screens/enterstack/ServerPaymentHistoryScreen';
import ServerPlanScreen from '../screens/enterstack/ServerPlanScreen';
import ServerRegistrationScreen from '../screens/enterstack/ServerRegistrationScreen';
import StoryFormScreen from '../screens/enterstack/StoryFormScreen';
import StorySelectionScreen from '../screens/enterstack/StorySelectionScreen';
import ExampleStoriesScreen from '../screens/examplestories/ExampleStoriesScreen';
import type { HelpStackParamList } from './HelpStack';
import HelpStackNavigator from './HelpStack';
import { drawerScreenOptions, readDrawerHeaderRoute, useDrawerChrome } from './drawerHeaderOptions';
import { drawerItemListeners } from './drawerInteraction';

export type StorySelectionMainStackParamList = {
  StorySelectionScreen: undefined;
  StoryForm: { storyId?: string; start?: 'blank' | 'packs' };
};

export type ServerManagementStackParamList = {
  ServerManagement: undefined;
  ServerDetail: { serverId: string };
  /** The plans a server sells and the way to pay for one; reached only from a server that sells them. */
  ServerPlan: { serverId: string };
  ServerPaymentHistory: { serverId: string };
  /** The same screen as the friendship stack's: opened from a server, back returns to the server. */
  Conversation: { serverId: string; peer: string; peerName?: string };
  ServerRegistration: { serverId?: string };
  MyProfile: { serverId: string };
  ChangePassword: { serverId: string };
};

export type FriendshipStackParamList = {
  FriendshipList: undefined;
  /** `serverId`: the server whose friend is being added, when the person came from that server's header. */
  FriendshipForm: { serverId?: string } | undefined;
  FriendDetail: { friendshipId: string };
  MessageInbox: undefined;
  /** `peer` is `admin` or the friend's id on that server; `peerName` is only for the header. */
  Conversation: { serverId: string; peer: string; peerName?: string };
};

/**
 * The packs stack.
 *
 * A stack rather than four flat drawer entries, for the same reason servers and friendships are
 * one: the form and the two catalogues are reached *from* the list and belong behind it. Registered
 * flat they had no back arrow - the drawer only draws one for a nested destination - and `goBack`
 * walked the drawer's own history, landing wherever the user happened to be before rather than on
 * the list.
 */
export type PacksStackParamList = {
  PackList: undefined;
  PackForm: { packId?: string } | undefined;
  PackBrowse: undefined;
  ShippedPacks: undefined;
};

/**
 * The settings stack: the credits screen is reached *from* Settings (tapping the Keres emblem)
 * and belongs behind it, so it gets a back arrow instead of a hamburger.
 */
export type SettingsStackParamList = {
  SettingsHome: undefined;
  Credits: undefined;
};

export type StorySelectionDrawerParamList = {
  StorySelectionMain: NavigatorScreenParams<StorySelectionMainStackParamList>;
  ServerManagementDrawer: NavigatorScreenParams<ServerManagementStackParamList>;
  FriendshipDrawer: NavigatorScreenParams<FriendshipStackParamList>;
  ImportStory: undefined;
  ExampleStories: undefined;
  PacksDrawer: NavigatorScreenParams<PacksStackParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
  HelpDrawer: NavigatorScreenParams<HelpStackParamList>;
};

const Drawer = createDrawerNavigator<StorySelectionDrawerParamList>();
const StorySelectionMainStack = createNativeStackNavigator<StorySelectionMainStackParamList>();
const ServerManagementStack = createNativeStackNavigator<ServerManagementStackParamList>();
const FriendshipStack = createNativeStackNavigator<FriendshipStackParamList>();
const PacksStack = createNativeStackNavigator<PacksStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

const storySelectionStackRootScreens = new Set([
  'StorySelectionScreen',
  'ServerManagement',
  'FriendshipList',
  'PackList',
  // The same reason as the story's drawer: the root of a stack opened from the menu shows no arrow.
  'HelpIndex',
  // The settings stack's own root: the drawer entry it sits behind is called `Settings`.
  'SettingsHome',
]);

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
        name="ServerDetail"
        component={ServerDetailScreen}
        options={{ headerTitle: t('server_detail_title') }}
      />
      <ServerManagementStack.Screen
        name="ServerPlan"
        component={ServerPlanScreen}
        options={{ headerTitle: t('server_plan_title') }}
      />
      <ServerManagementStack.Screen
        name="ServerPaymentHistory"
        component={ServerPaymentHistoryScreen}
        options={{ headerTitle: t('payment_history_title') }}
      />
      <ServerManagementStack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={{ headerTitle: t('messages_title') }}
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
      <FriendshipStack.Screen
        name="MessageInbox"
        component={MessageInboxScreen}
        options={{ headerTitle: t('messages_title') }}
      />
      <FriendshipStack.Screen
        name="Conversation"
        component={ConversationScreen}
        options={{ headerTitle: t('messages_title') }}
      />
    </FriendshipStack.Navigator>
  );
};

const PacksStackNavigator = () => {
  const { t } = useTranslation();

  return (
    <PacksStack.Navigator
      screenOptions={{
        headerShown: false, // Header is managed by the Drawer Navigator
      }}
    >
      <PacksStack.Screen
        name="PackList"
        component={PackListScreen}
        options={{ headerTitle: t('packs_title') }}
      />
      <PacksStack.Screen
        name="PackForm"
        component={PackFormScreen}
        options={({ route }) => ({
          headerTitle: route.params?.packId ? t('packs_reextract') : t('packs_create'),
        })}
      />
      {/* Browsing lists other people's packs on a server; a serverless build has none. */}
      {isServerless() ? null : (
        <PacksStack.Screen
          name="PackBrowse"
          component={PackBrowseScreen}
          options={{ headerTitle: t('packs_browse_title') }}
        />
      )}
      <PacksStack.Screen
        name="ShippedPacks"
        component={ShippedPacksScreen}
        options={{ headerTitle: t('shipped_packs_title') }}
      />
    </PacksStack.Navigator>
  );
};

const SettingsStackNavigator = () => {
  const { t } = useTranslation();

  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerShown: false, // Header is managed by the Drawer Navigator
      }}
    >
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{ headerTitle: t('settings_title') }}
      />
      <SettingsStack.Screen
        name="Credits"
        component={CreditsScreen}
        options={{ headerTitle: t('credits_title') }}
      />
    </SettingsStack.Navigator>
  );
};

const StorySelectionNavigator = () => {
  const chrome = useDrawerChrome();
  const { t, isCompact, isWide, drawerWidth, setDrawerWidth, maximumWidth } = chrome;
  const drawerIcon = (name: keyof typeof Ionicons.glyphMap) =>
    function DrawerMenuIcon({ color, size }: { color: string; size: number }) {
      return <Ionicons name={name} color={color} size={size} />;
    };

  return (
    <>
      <Drawer.Navigator
        defaultStatus={isWide ? 'open' : 'closed'}
        drawerContent={(props) => (
          <ResizableDrawerContent
            {...props}
            drawerId="story-selection"
            drawerWidth={drawerWidth}
            maximumWidth={maximumWidth}
            onDrawerWidthChange={setDrawerWidth}
            resizable={!isCompact}
          >
            <SelectionDrawerMenu
              state={props.state}
              navigation={props.navigation}
              drawerId="story-selection"
            />
          </ResizableDrawerContent>
        )}
        screenOptions={({ navigation, route }) => {
          const header = readDrawerHeaderRoute(route);
          const showNestedBackButton =
            (header.activeRouteName !== route.name &&
              !storySelectionStackRootScreens.has(header.activeRouteName)) ||
            header.nestedStackHasBack;
          // Same lazy resolution as the main drawer's back button: the route object captured
          // while the header mounts can hold a partial state, so the live target is read
          // from the drawer navigation at press time.
          const goBackInNestedStack = () => {
            const liveDrawerRoute = navigation
              .getState()
              .routes.find((drawerRoute) => drawerRoute.key === route.key) as
              | (typeof route & { state?: NavigationState })
              | undefined;
            const target = liveDrawerRoute?.state?.key ?? header.nestedStackKey;

            if (target) {
              navigation.dispatch({ ...StackActions.pop(), target });
            } else {
              navigation.dispatch(StackActions.pop());
            }
          };

          return drawerScreenOptions({
            chrome,
            navigation,
            route,
            header,
            showNestedBackButton,
            goBack: goBackInNestedStack,
          });
        }}
      >
        <Drawer.Screen
          name="StorySelectionMain"
          component={StorySelectionMainStackNavigator}
          options={{
            title: t('story_selection_title'),
            drawerLabel: t('story_selection_title'),
            drawerIcon: drawerIcon('book-outline'),
          }}
          listeners={drawerItemListeners('StorySelectionMain', 'StorySelectionScreen')}
        />
        {/* Servers and friends only exist with a server: a serverless build registers neither. */}
        {isServerless() ? null : (
          <>
            <Drawer.Screen
              name="ServerManagementDrawer"
              component={ServerManagementStackNavigator}
              options={{
                title: t('manage_servers'),
                drawerLabel: t('manage_servers'),
                drawerIcon: ({ color, size }) => <ServerDrawerIcon color={color} size={size} />,
              }}
              listeners={drawerItemListeners('ServerManagementDrawer', 'ServerManagement')}
            />
            <Drawer.Screen
              name="FriendshipDrawer"
              component={FriendshipStackNavigator}
              options={{
                title: t('manage_friendships'),
                drawerLabel: t('manage_friendships'),
                drawerIcon: ({ color, size }) => <FriendshipDrawerIcon color={color} size={size} />,
              }}
              listeners={drawerItemListeners('FriendshipDrawer', 'FriendshipList')}
            />
          </>
        )}
        {/*
        Importing lives in the main menu, not in a story's menu: it creates a new story, so there is
        no active one at that point. Taking a story out (publish, export) lives in the story's own menu.
      */}
        <Drawer.Screen
          name="ImportStory"
          component={ImportStoryScreen}
          options={{
            title: t('import_story_title'),
            drawerLabel: t('import_story_title'),
            drawerIcon: drawerIcon('download-outline'),
          }}
          listeners={drawerItemListeners('ImportStory')}
        />
        {/*
        Same reasoning as Import and the examples below: a pack is made from a story and
        applied when a new one is created, so it belongs to the app's menu rather than to any single
        story's.
      */}
        <Drawer.Screen
          name="PacksDrawer"
          component={PacksStackNavigator}
          options={{
            title: t('packs_title'),
            drawerLabel: t('packs_title'),
            drawerIcon: drawerIcon('archive-outline'),
          }}
          listeners={drawerItemListeners('PacksDrawer', 'PackList')}
        />
        {/*
        Same reasoning as Import above: installing an example creates a new
        story, so it depends on (and belongs to the menu of) no already-open story.
      */}
        <Drawer.Screen
          name="ExampleStories"
          component={ExampleStoriesScreen}
          options={{
            title: t('examples_title'),
            drawerLabel: t('examples_title'),
            drawerIcon: drawerIcon('flask-outline'),
          }}
          listeners={drawerItemListeners('ExampleStories')}
        />
        <Drawer.Screen
          name="HelpDrawer"
          component={HelpStackNavigator}
          options={{
            title: t('help_title'),
            drawerLabel: t('help_title'),
            drawerIcon: drawerIcon('help-circle-outline'),
          }}
          listeners={drawerItemListeners('HelpDrawer', 'HelpIndex')}
        />
        <Drawer.Screen
          name="Settings"
          component={SettingsStackNavigator}
          options={{
            title: t('settings_title'),
            drawerLabel: t('settings_title'),
            drawerIcon: drawerIcon('settings-outline'),
          }}
          listeners={drawerItemListeners('Settings', 'SettingsHome')}
        />
      </Drawer.Navigator>
      <ShippedPacksInstallerOverlay />
    </>
  );
};

export default StorySelectionNavigator;
