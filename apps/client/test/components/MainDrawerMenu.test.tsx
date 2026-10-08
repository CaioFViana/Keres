import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockOpenLeaf = jest.fn();
let mockBadges: Record<string, unknown> = {};
let mockFocused: { route: string; focus: { screen?: string; params?: Record<string, unknown> } } = {
  route: 'MainDashboard',
  focus: {},
};

jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('@react-navigation/drawer', () => ({
  __esModule: true,
  DrawerItem: ({
    label,
    accessibilityLabel,
    focused,
    onPress,
    testID,
  }: {
    label: (props: { color: string }) => React.ReactNode;
    accessibilityLabel: string;
    focused: boolean;
    onPress: () => void;
    testID: string;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      react.Fragment,
      null,
      react.createElement(
        native.Text,
        { testID, onPress },
        `${accessibilityLabel}${focused ? ':focused' : ''}`,
      ),
      label({ color: '#111' }),
    );
  },
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      text: '#111',
      textSecondary: '#666',
      primary: '#00f',
      border: '#ddd',
      error: '#f00',
      onPrimary: '#fff',
    },
  }),
}));
jest.mock('../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({ term: (key: string) => `term:${key}` }),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: (selector: (state: unknown) => unknown) =>
    selector({ suggestLiteraryDevices: false }),
}));
jest.mock('../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ selectedStory: { id: 'story-1' } }),
}));
jest.mock('../../src/hooks/useStoryMenuBadges', () => ({
  __esModule: true,
  useStoryMenuBadges: () => mockBadges,
}));
jest.mock('../../src/guides/useGuideAnchor', () => ({
  __esModule: true,
  useGuideAnchor: () => undefined,
}));
jest.mock('../../src/navigation/openMenuLeaf', () => ({
  __esModule: true,
  nestedFocusOf: () => mockFocused,
  openMenuLeaf: (...args: unknown[]) => mockOpenLeaf(...args),
}));

import { MainDrawerMenu } from '../../src/components/common/navigation/MainDrawerMenu/MainDrawerMenu';

const renderMenu = (props: Partial<React.ComponentProps<typeof MainDrawerMenu>> = {}) =>
  render(
    <MainDrawerMenu
      state={{ routes: [], index: 0 } as never}
      navigation={{} as never}
      drawerId="main-system"
      {...props}
    />,
  );

beforeEach(async () => {
  jest.clearAllMocks();
  mockFocused = { route: 'MainDashboard', focus: {} };
  mockBadges = {};
  await AsyncStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('MainDrawerMenu', () => {
  it('shows the story and the arc it is looked at through', async () => {
    const view = await renderMenu({
      story: { title: 'Cinderella', typeLabel: 'Linear' },
      arcLabel: 'Book 1',
    });

    expect(view.getByText('Cinderella')).toBeTruthy();
    expect(view.getByText('Linear')).toBeTruthy();
    expect(view.getByText('Book 1')).toBeTruthy();
  });

  it('leaves the arc row out when there is only one arc to look through', async () => {
    const view = await renderMenu({ story: { title: 'Cinderella', typeLabel: 'Linear' } });

    expect(view.queryByTestId('drawer-arc-picker')).toBeNull();
  });

  it('asks for the arc picker through the arc entry', async () => {
    const view = await renderMenu({ arcLabel: 'Book 1' });

    await fireEvent.press(view.getByTestId('drawer-arc-picker'));

    expect(mockOpenLeaf.mock.calls[0][2]).toMatchObject({ id: 'ArcContext', route: 'ArcContext' });
  });

  it('opens the groups that start open and keeps the others shut', async () => {
    const view = await renderMenu();

    expect(view.getByTestId('drawer-item-MainDashboard')).toBeTruthy();
    expect(view.getByTestId('drawer-item-CharactersStack')).toBeTruthy();
    expect(view.getByTestId('drawer-item-GalleryStack')).toBeTruthy();
    expect(view.queryByTestId('drawer-item-CalendarsStack')).toBeNull();
    expect(view.queryByTestId('drawer-item-NotesStack')).toBeNull();
  });

  it('opens and closes a group when its heading is pressed', async () => {
    const view = await renderMenu();

    await fireEvent.press(view.getByTestId('drawer-group-world'));
    expect(view.getByTestId('drawer-item-CalendarsStack')).toBeTruthy();

    await fireEvent.press(view.getByTestId('drawer-group-world'));
    expect(view.queryByTestId('drawer-item-CalendarsStack')).toBeNull();
  });

  it('opens the group that holds the screen on show, and marks its entry', async () => {
    mockFocused = {
      route: 'WorldRulesStack',
      focus: { screen: 'WorldRules', params: { section: 'fauna' } },
    };
    const view = await renderMenu();

    expect(view.getByTestId('drawer-item-WorldRulesStack:fauna').props.children).toBe(
      'world_piece_section_fauna:focused',
    );
    expect(view.getByTestId('drawer-item-WorldRulesStack:flora').props.children).toBe(
      'world_piece_section_flora',
    );
  });

  it('marks the entry of the screen on show among the always-there ones', async () => {
    mockFocused = { route: 'StorySettings', focus: { screen: 'StorySettingsIndex' } };
    const view = await renderMenu();

    expect(view.getByTestId('drawer-item-StorySettings').props.children).toBe(
      'story_settings_title:focused',
    );
  });

  it('opens an entry through the menu opener', async () => {
    const view = await renderMenu();

    await fireEvent.press(view.getByTestId('drawer-item-CharactersStack'));

    expect(mockOpenLeaf.mock.calls[0][2]).toMatchObject({ id: 'CharactersStack' });
  });

  it('keeps the settings, help and leaving the story in view whatever is open', async () => {
    const view = await renderMenu();

    expect(view.getByTestId('drawer-item-StorySettings')).toBeTruthy();
    expect(view.getByTestId('drawer-item-HelpDrawer')).toBeTruthy();
    expect(view.getByTestId('drawer-item-StorySelection')).toBeTruthy();
  });

  it('puts the search at the top, out of the groups', async () => {
    const view = await renderMenu();

    await fireEvent.press(view.getByTestId('drawer-item-GlobalSearch'));

    expect(mockOpenLeaf.mock.calls[0][2]).toMatchObject({
      id: 'GlobalSearch',
      route: 'GlobalSearch',
    });
    await fireEvent.press(view.getByTestId('drawer-group-review'));
    expect(view.getAllByTestId('drawer-item-GlobalSearch')).toHaveLength(1);
  });

  it('says what is behind an entry without opening it', async () => {
    mockBadges = { OperationLogStack: { kind: 'count', value: 3 } };
    const view = await renderMenu();
    await fireEvent.press(view.getByTestId('drawer-group-review'));

    expect(view.getByTestId('drawer-badge-OperationLogStack')).toBeTruthy();
    expect(view.getByText('3')).toBeTruthy();
  });

  it('marks a shut group while something inside it asks for attention', async () => {
    mockBadges = { OperationLogStack: { kind: 'count', value: 2, attention: true } };
    const view = await renderMenu();

    expect(view.getByTestId('drawer-group-dot-review')).toBeTruthy();
    await fireEvent.press(view.getByTestId('drawer-group-review'));
    expect(view.queryByTestId('drawer-group-dot-review')).toBeNull();
  });

  it('does not mark a shut group for a badge that only informs', async () => {
    mockBadges = { OperationLogStack: { kind: 'count', value: 2 } };
    const view = await renderMenu();

    expect(view.queryByTestId('drawer-group-dot-review')).toBeNull();
  });

  it('keeps what the person opened or shut, story by story', async () => {
    const view = await renderMenu();
    await fireEvent.press(view.getByTestId('drawer-group-world'));
    await fireEvent.press(view.getByTestId('drawer-group-material'));

    await waitFor(async () =>
      expect(
        JSON.parse((await AsyncStorage.getItem('@keres/drawer-groups/story-1')) ?? '{}'),
      ).toEqual({
        world: true,
        material: false,
      }),
    );
  });

  it('brings the groups back as they were left', async () => {
    await AsyncStorage.setItem(
      '@keres/drawer-groups/story-1',
      JSON.stringify({ world: true, material: false }),
    );
    const view = await renderMenu();

    await waitFor(() => expect(view.getByTestId('drawer-item-CalendarsStack')).toBeTruthy());
    expect(view.queryByTestId('drawer-item-GalleryStack')).toBeNull();
  });

  it('reads a corrupt record as nothing chosen', async () => {
    await AsyncStorage.setItem('@keres/drawer-groups/story-1', '{nope');
    const view = await renderMenu();
    await act(async () => {});

    expect(view.getByTestId('drawer-item-GalleryStack')).toBeTruthy();
    expect(view.queryByTestId('drawer-item-CalendarsStack')).toBeNull();
  });

  it('never hides the screen on show behind a group left shut', async () => {
    await AsyncStorage.setItem('@keres/drawer-groups/story-1', JSON.stringify({ write: false }));
    const view = await renderMenu();
    await act(async () => {});

    expect(view.getByTestId('drawer-item-MainDashboard').props.children).toBe(
      'dashboard_title:focused',
    );
  });
});
