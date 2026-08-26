import { render } from '@testing-library/react-native';
import React from 'react';

const mockDrawerScreens: Array<Record<string, any>> = [];
const mockDrawerNavigatorProps: Array<Record<string, any>> = [];
const mockResponsiveLayout = { isCompact: false, isWide: true, width: 1200 };
// An object, and not a loose boolean: `jest.mock` is hoisted above the assignments, so the
// factory has to read the value at call time, not capture it at definition time.
const mockHasRegisteredServer = { value: true };

function mockDrawerNavigator({
  children,
  ...props
}: {
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  mockDrawerNavigatorProps.push(props);
  return <>{children}</>;
}

function mockDrawerScreen(props: Record<string, any>) {
  mockDrawerScreens.push(props);
  return null;
}

function mockStackNavigator({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function mockStackScreen() {
  return null;
}

jest.mock('@react-navigation/drawer', () => ({
  __esModule: true,
  createDrawerNavigator: () => ({ Navigator: mockDrawerNavigator, Screen: mockDrawerScreen }),
  DrawerActions: { toggleDrawer: () => ({ type: 'TOGGLE_DRAWER' }) },
}));
jest.mock('@react-navigation/native-stack', () => ({
  __esModule: true,
  createNativeStackNavigator: () => ({ Navigator: mockStackNavigator, Screen: mockStackScreen }),
}));
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  DrawerActions: { toggleDrawer: () => ({ type: 'TOGGLE_DRAWER' }) },
  getFocusedRouteNameFromRoute: jest.fn(() => undefined),
}));
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { surface: '#fff', text: '#111', primary: '#00f' } }),
}));
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: () => mockResponsiveLayout,
}));
jest.mock('../../src/hooks/useHasRegisteredServer', () => ({
  __esModule: true,
  useHasRegisteredServer: () => mockHasRegisteredServer.value,
}));
jest.mock(
  '../../src/components/common/navigation/ResizableDrawerContent/ResizableDrawerContent',
  () => ({
    __esModule: true,
    DRAWER_MIN_WIDTH: 280,
    default: () => null,
    useResizableDrawerWidth: () => ({
      drawerWidth: 360,
      maximumWidth: 600,
      setDrawerWidth: jest.fn(),
    }),
  }),
);
jest.mock(
  '../../src/components/common/navigation/NavigationBackButton/NavigationBackButton',
  () => ({ __esModule: true, default: () => null }),
);
jest.mock('../../src/navigation/HelpStack', () => ({ __esModule: true, default: () => null }));
jest.mock('../../src/help/contextualHelp', () => ({ __esModule: true, screenHelpPage: {} }));

jest.mock('../../src/screens/enterstack/AppSettingsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/ChangePasswordScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/FriendDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/FriendshipFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/FriendshipListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/ImportExportScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/PublishStoryScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/MyProfileScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/ServerManagementScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/ServerRegistrationScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/StoryFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/enterstack/StorySelectionScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/examplestories/ExampleStoriesScreen', () => ({
  __esModule: true,
  default: () => null,
}));

import StorySelectionStack from '../../src/navigation/StorySelectionStack';

const drawerScreen = (name: string) => mockDrawerScreens.find((screen) => screen.name === name);

beforeEach(() => {
  jest.clearAllMocks();
  mockDrawerScreens.length = 0;
  mockDrawerNavigatorProps.length = 0;
  mockResponsiveLayout.isCompact = false;
  mockResponsiveLayout.isWide = true;
  mockResponsiveLayout.width = 1200;
});

async function renderDrawer() {
  await render(<StorySelectionStack />);
  expect(mockDrawerScreens).toHaveLength(9);
}

it('keeps the wide story-selection menu permanently open with its main routes', async () => {
  await renderDrawer();
  const navigator = mockDrawerNavigatorProps.at(-1);
  const options = navigator?.screenOptions({ navigation: {}, route: { name: 'Settings' } });

  expect(navigator).toMatchObject({ defaultStatus: 'open' });
  expect(options).toMatchObject({ drawerType: 'permanent', swipeEnabled: false });
  expect(mockDrawerScreens.map((screen) => screen.name)).toEqual([
    'StorySelectionMain',
    'ServerManagementDrawer',
    'FriendshipDrawer',
    'ImportExport',
    'PublishStory',
    'ExampleStories',
    'StoryDevicesDrawer',
    'HelpDrawer',
    'Settings',
  ]);
});

it.each([
  ['StorySelectionMain', 'StorySelectionScreen'],
  ['ServerManagementDrawer', 'ServerManagement'],
  ['FriendshipDrawer', 'FriendshipList'],
  ['StoryDevicesDrawer', 'DeviceIndex'],
  ['HelpDrawer', 'HelpIndex'],
])('returns %s to its root screen from a drawer press', async (drawerName, screen) => {
  await renderDrawer();
  const navigation = { navigate: jest.fn() };
  const preventDefault = jest.fn();
  const listeners = drawerScreen(drawerName)?.listeners({ navigation });

  listeners.drawerItemPress({ preventDefault });

  expect(preventDefault).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith(drawerName, { screen });
});

it('uses the compact front drawer dimensions on small screens', async () => {
  mockResponsiveLayout.isCompact = true;
  mockResponsiveLayout.isWide = false;
  mockResponsiveLayout.width = 500;
  await renderDrawer();
  const navigator = mockDrawerNavigatorProps.at(-1);
  const options = navigator?.screenOptions({ navigation: {}, route: { name: 'Settings' } });

  expect(navigator).toMatchObject({ defaultStatus: 'closed' });
  expect(options).toMatchObject({ drawerType: 'front', swipeEnabled: true });
  expect(options.drawerStyle).toMatchObject({ minWidth: 300, width: 300 });
});

describe('the publish entry', () => {
  it('is offered when a server is registered', async () => {
    mockHasRegisteredServer.value = true;
    await renderDrawer();

    expect(drawerScreen('PublishStory')?.options.drawerItemStyle).toMatchObject({
      height: undefined,
    });
  });

  // The screen stays registered - only the menu item disappears, so that a direct navigation (or the
  // help's link) does not break when the last server is removed.
  it('is hidden when no server is registered', async () => {
    mockHasRegisteredServer.value = false;
    await renderDrawer();

    expect(drawerScreen('PublishStory')?.options.drawerItemStyle).toMatchObject({
      height: 0,
      overflow: 'hidden',
    });
  });
});
