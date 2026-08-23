import { render } from '@testing-library/react-native';
import React from 'react';

const mockDrawerScreens: Array<Record<string, any>> = [];
const mockDrawerNavigatorProps: Array<Record<string, any>> = [];
function mockReset(payload: unknown) {
  return { type: 'RESET', payload };
}
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
const mockResponsiveLayout = { isCompact: false, isWide: false, width: 1000 };

jest.mock('@react-navigation/drawer', () => ({
  __esModule: true,
  createDrawerNavigator: () => ({ Navigator: mockDrawerNavigator, Screen: mockDrawerScreen }),
  DrawerActions: { toggleDrawer: jest.fn(() => ({ type: 'TOGGLE_DRAWER' })) },
}));
jest.mock('@react-navigation/native-stack', () => ({
  __esModule: true,
  createNativeStackNavigator: () => ({ Navigator: mockStackNavigator, Screen: mockStackScreen }),
}));
jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  CommonActions: { reset: mockReset },
  DrawerActions: { toggleDrawer: jest.fn(() => ({ type: 'TOGGLE_DRAWER' })) },
  getFocusedRouteNameFromRoute: jest.fn(() => undefined),
  StackActions: { pop: jest.fn(() => ({ type: 'POP' })) },
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
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: jest.fn((selector) => {
    const state = { selectedStory: { title: 'A jornada', type: 'linear' } };
    return selector ? selector(state) : state;
  }),
}));
jest.mock('../../src/hooks/useResponsiveLayout', () => ({
  __esModule: true,
  useResponsiveLayout: jest.fn(() => mockResponsiveLayout),
}));
jest.mock('../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: jest.fn(),
}));
jest.mock(
  '../../src/components/common/navigation/ResizableDrawerContent/ResizableDrawerContent',
  () => ({
    __esModule: true,
    DRAWER_MIN_WIDTH: 280,
    default: () => null,
    useResizableDrawerWidth: jest.fn(() => ({
      drawerWidth: 360,
      maximumWidth: 600,
      setDrawerWidth: jest.fn(),
    })),
  }),
);
jest.mock(
  '../../src/components/common/navigation/NavigationBackButton/NavigationBackButton',
  () => ({ __esModule: true, default: () => null }),
);
jest.mock(
  '@/src/components/features/gallery/GalleryManager/GalleryMediaViewerOverlay',
  () => () => null,
);
jest.mock(
  '@/src/components/features/presence-matrix/PresenceMatrixViewerOverlay',
  () => () => null,
);
jest.mock('@/src/components/features/story-timeline/StoryTimelineViewerOverlay', () => () => null);
jest.mock('../../src/navigation/HelpStack', () => ({ __esModule: true, default: () => null }));
jest.mock('../../src/navigation/StatsStack', () => ({ __esModule: true, default: () => null }));
jest.mock('../../src/help/contextualHelp', () => ({
  __esModule: true,
  screenHelpPage: { ChaptersStack: 'chapters' },
}));

jest.mock('../../src/screens/chapters/ChapterDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/chapters/ChapterFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/chapters/ChapterListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/characterrelations/CharacterRelationGraphScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/characters/CharacterDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/characters/CharacterFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/characters/CharacterListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/choices/ChoiceDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/choices/ChoiceFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/choices/ChoiceListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/choices/ChoiceViewScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/comments/CommentListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/gallery/GalleryDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/gallery/GalleryListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/globalsearch/GlobalSearchScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/itemJourneys/ItemJourneyDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/itemJourneys/ItemJourneyFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/items/ItemDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/items/ItemFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/items/ItemListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/locations/LocationDetailsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/locations/LocationFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/locations/LocationGraphScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/locations/LocationListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/mainstorystack/MainDashboardScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/mainstorystack/StoryAnalysisScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/mainstorystack/StorySettingsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/notes/NoteDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/notes/NoteFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/notes/NoteListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/operationlog/OperationLogDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/operationlog/OperationLogListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/scenes/SceneDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/scenes/SceneFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/storyschema/StorySchemaFieldFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/storyschema/StorySchemaListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/suggestions/SuggestionsScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/tags/TagDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/tags/TagFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/tags/TagListScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/worldrules/WorldRuleDetailScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/worldrules/WorldRuleFormScreen', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('../../src/screens/worldrules/WorldRuleListScreen', () => ({
  __esModule: true,
  default: () => null,
}));

import MainSystemStack from '../../src/navigation/MainSystemStack';

const drawerScreen = (name: string) => mockDrawerScreens.find((screen) => screen.name === name);

beforeEach(() => {
  jest.clearAllMocks();
  mockDrawerScreens.length = 0;
  mockDrawerNavigatorProps.length = 0;
  mockResponsiveLayout.isCompact = false;
  mockResponsiveLayout.isWide = false;
  mockResponsiveLayout.width = 1000;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

async function renderDrawer() {
  await render(<MainSystemStack />);
  expect(mockDrawerScreens).toHaveLength(21);
}

it('configures a compact, front drawer and preserves the current story as its dashboard title', async () => {
  await renderDrawer();
  const navigator = mockDrawerNavigatorProps.at(-1);
  const options = navigator?.screenOptions({ navigation: {}, route: { name: 'ChaptersStack' } });

  expect(navigator).toMatchObject({ defaultStatus: 'closed', backBehavior: 'history' });
  expect(options).toMatchObject({ drawerType: 'front', swipeEnabled: true });
  expect(options.drawerStyle).toMatchObject({ minWidth: 280, width: 360 });
  expect(drawerScreen('MainDashboard')?.options).toMatchObject({ title: 'A jornada' });
  expect(drawerScreen('ChoicesStack')?.options.drawerItemStyle).toMatchObject({ height: 0 });
});

it.each([
  ['CharactersStack', 'Characters'],
  ['ChaptersStack', 'Chapters'],
  ['ChoicesStack', 'Choices'],
  ['LocationsStack', 'Locations'],
  ['ItemsStack', 'Items'],
  ['TagsStack', 'Tags'],
  ['WorldRulesStack', 'WorldRules'],
  ['NotesStack', 'Notes'],
  ['GalleryStack', 'GalleryList'],
  ['StorySchemaStack', 'StorySchemaList'],
  ['CommentsStack', 'CommentsList'],
  ['OperationLogStack', 'OperationLog'],
  ['StatsDrawer', 'StatList'],
  ['StoryDevicesDrawer', 'DeviceIndex'],
  ['HelpDrawer', 'HelpIndex'],
])('returns %s to its list screen when its drawer item is pressed', async (drawerName, screen) => {
  await renderDrawer();
  const navigation = { navigate: jest.fn() };
  const preventDefault = jest.fn();
  const listeners = drawerScreen(drawerName)?.listeners({ navigation });

  listeners.drawerItemPress({ preventDefault });

  expect(preventDefault).toHaveBeenCalledTimes(1);
  expect(navigation.navigate).toHaveBeenCalledWith(drawerName, { screen });
});

it('resets the root stack to story selection instead of restoring a nested drawer state', async () => {
  await renderDrawer();
  const root = { dispatch: jest.fn() };
  const navigation = { getParent: jest.fn(() => root), dispatch: jest.fn() };
  const preventDefault = jest.fn();
  const listeners = drawerScreen('StorySelection')?.listeners({ navigation });

  listeners.drawerItemPress({ preventDefault });

  expect(preventDefault).toHaveBeenCalledTimes(1);
  expect(root.dispatch).toHaveBeenCalledWith({
    type: 'RESET',
    payload: { index: 0, routes: [{ name: 'StorySelection' }] },
  });
  expect(navigation.dispatch).not.toHaveBeenCalled();
});
