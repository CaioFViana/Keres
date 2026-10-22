import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { NavigationState, NavigatorScreenParams } from '@react-navigation/native';
import { StackActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import FriendshipDrawerIcon from '@/src/components/features/messages/FriendshipDrawerIcon';
import ServerDrawerIcon from '@/src/components/features/messages/ServerDrawerIcon';
import StorySelectionMenu from '@/src/components/common/navigation/SelectionDrawerMenu/SelectionDrawerMenu';
import ResizableDrawerContent from '@/src/components/common/navigation/ResizableDrawerContent/ResizableDrawerContent';
import ShippedPacksInstallerOverlay from '@/src/components/features/packs/ShippedPacksInstallerOverlay';
import { isServerless } from '@/src/utils/platform/clientFlavor';
import SettingsScreen from '@/src/screens/enter-stack/account/AppSettingsScreen';
import ChangePasswordScreen from '@/src/screens/enter-stack/account/ChangePasswordScreen';
import CreditsScreen from '@/src/screens/enter-stack/account/CreditsScreen';
import FriendDetailScreen from '@/src/screens/enter-stack/social/FriendDetailScreen';
import FriendshipFormScreen from '@/src/screens/enter-stack/social/FriendshipFormScreen';
import ConversationScreen from '@/src/screens/enter-stack/social/ConversationScreen';
import FriendshipListScreen from '@/src/screens/enter-stack/social/FriendshipListScreen';
import MessageInboxScreen from '@/src/screens/enter-stack/social/MessageInboxScreen';
import ImportStoryScreen from '@/src/screens/enter-stack/story-entry/ImportStoryScreen';
import ShowcaseAuthorScreen from '@/src/screens/showcase/ShowcaseAuthorScreen';
import ShowcaseBrowseScreen from '@/src/screens/showcase/ShowcaseBrowseScreen';
import ShowcaseHomeScreen from '@/src/screens/showcase/ShowcaseHomeScreen';
import ShowcasePackScreen from '@/src/screens/showcase/ShowcasePackScreen';
import ShowcaseStoryScreen from '@/src/screens/showcase/ShowcaseStoryScreen';
import PackBrowseScreen from '@/src/screens/packs/PackBrowseScreen';
import PackFormScreen from '@/src/screens/packs/PackFormScreen';
import PackListScreen from '@/src/screens/packs/PackListScreen';
import ShippedPacksScreen from '@/src/screens/packs/ShippedPacksScreen';
import MyProfileScreen from '@/src/screens/enter-stack/account/MyProfileScreen';
import PublicProfileScreen from '@/src/screens/enter-stack/account/PublicProfileScreen';
import ServerDetailScreen from '@/src/screens/enter-stack/servers/ServerDetailScreen';
import ServerManagementScreen from '@/src/screens/enter-stack/servers/ServerManagementScreen';
import ServerPaymentHistoryScreen from '@/src/screens/enter-stack/servers/ServerPaymentHistoryScreen';
import ServerPlanScreen from '@/src/screens/enter-stack/servers/ServerPlanScreen';
import ServerRegistrationScreen from '@/src/screens/enter-stack/servers/ServerRegistrationScreen';
import ServerVerificationScreen from '@/src/screens/enter-stack/servers/ServerVerificationScreen';
import StoryFormScreen from '@/src/screens/enter-stack/story-entry/StoryFormScreen';
import StorySelectionScreen from '@/src/screens/enter-stack/story-entry/StorySelectionScreen';
import ExampleStoriesScreen from '@/src/screens/example-stories/ExampleStoriesScreen';
import type { HelpStackParamList } from './HelpStack';
import { HelpStackNavigator } from '@/src/navigation/lazyStacks';
import {
  drawerScreenOptions,
  readDrawerHeaderRoute,
  useDrawerChrome,
} from '@/src/navigation/drawer/drawerHeaderOptions';
import { drawerItemListeners } from '@/src/navigation/drawer/drawerInteraction';

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
  /** `address`: a server the person came across (a pasted link) and may want to register. */
  ServerRegistration: { serverId?: string; address?: string };
  /** The age check of a pending account on this server; opened by registration or login, back returns to the server list. */
  ServerVerification: { serverId: string };
  MyProfile: { serverId: string };
  PublicProfile: { serverId: string };
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

/** Whose public site a showcase screen shows: a server the person registered, or the origin of one they only have a link to. */
export type ShowcaseSourceParams = { serverId?: string; guestOrigin?: string };

/**
 * The showcase stack: the public sites of servers, read from inside the app. Stories open *from* the home (where
 * a link is pasted) and belong behind it, for the same reason as the packs' screens.
 */
export type ShowcaseTab = 'stories' | 'authors' | 'packs';

export type ShowcaseStackParamList = {
  ShowcaseHome: undefined;
  /** The lists of one server's public site: its stories, its authors and its packs. */
  ShowcaseBrowse: ShowcaseSourceParams & { tab?: ShowcaseTab };
  ShowcaseStory: ShowcaseSourceParams & { storyId: string };
  ShowcaseAuthor: ShowcaseSourceParams & { username: string };
  ShowcasePack: ShowcaseSourceParams & { packId: string };
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
  ShowcaseDrawer: NavigatorScreenParams<ShowcaseStackParamList>;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
  HelpDrawer: NavigatorScreenParams<HelpStackParamList>;
};

const Drawer = createDrawerNavigator<StorySelectionDrawerParamList>();
const StorySelectionMainStack = createNativeStackNavigator<StorySelectionMainStackParamList>();
const ServerManagementStack = createNativeStackNavigator<ServerManagementStackParamList>();
const FriendshipStack = createNativeStackNavigator<FriendshipStackParamList>();
const PacksStack = createNativeStackNavigator<PacksStackParamList>();
const ShowcaseStack = createNativeStackNavigator<ShowcaseStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();

const storySelectionStackRootScreens = new Set([
  'StorySelectionScreen',
  'ServerManagement',
  'FriendshipList',
  'PackList',
  'ShowcaseHome',
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
        name="ServerVerification"
        component={ServerVerificationScreen}
        options={{ headerTitle: t('age_verification_title') }}
      />
      <ServerManagementStack.Screen
        name="MyProfile"
        component={MyProfileScreen}
        options={{ headerTitle: t('my_profile_title') }}
      />
      <ServerManagementStack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{ headerTitle: t('author_page_title') }}
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

const ShowcaseStackNavigator = () => {
  const { t } = useTranslation();

  return (
    <ShowcaseStack.Navigator
      screenOptions={{
        headerShown: false, // Header is managed by the Drawer Navigator
      }}
    >
      <ShowcaseStack.Screen
        name="ShowcaseHome"
        component={ShowcaseHomeScreen}
        options={{ headerTitle: t('showcase_title') }}
      />
      <ShowcaseStack.Screen
        name="ShowcaseBrowse"
        component={ShowcaseBrowseScreen}
        options={{ headerTitle: t('showcase_title') }}
      />
      <ShowcaseStack.Screen
        name="ShowcaseAuthor"
        component={ShowcaseAuthorScreen}
        options={{ headerTitle: t('showcase_author_title') }}
      />
      <ShowcaseStack.Screen
        name="ShowcasePack"
        component={ShowcasePackScreen}
        options={{ headerTitle: t('showcase_pack_title') }}
      />
      <ShowcaseStack.Screen
        name="ShowcaseStory"
        component={ShowcaseStoryScreen}
        options={{ headerTitle: t('showcase_story_title') }}
      />
    </ShowcaseStack.Navigator>
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
            <StorySelectionMenu
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
              name="ShowcaseDrawer"
              component={ShowcaseStackNavigator}
              options={{
                title: t('showcase_title'),
                drawerLabel: t('showcase_title'),
                drawerIcon: drawerIcon('storefront-outline'),
              }}
              listeners={drawerItemListeners('ShowcaseDrawer', 'ShowcaseHome')}
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
