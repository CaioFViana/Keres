import { cleanup, fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const mockOpenLeaf = jest.fn();
let mockFocused: { route: string; focus: { screen?: string; params?: Record<string, unknown> } } = {
  route: 'MainDashboard',
  focus: {},
};

jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('@react-navigation/drawer', () => ({
  __esModule: true,
  DrawerItem: ({
    label,
    focused,
    onPress,
    testID,
  }: {
    label: string;
    focused: boolean;
    onPress: () => void;
    testID: string;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      { testID, onPress },
      `${label}${focused ? ':focused' : ''}`,
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
    colors: { text: '#111', textSecondary: '#666', primary: '#00f', border: '#ddd' },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = { route: 'MainDashboard', focus: {} };
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
});
