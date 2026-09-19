import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockUpdateStory = jest.fn();
const mockSetSelectedStory = jest.fn();
const mockApplyTheme = jest.fn();
const mockAlert = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
let mockStory: { id: string; theme: string | null } | null = { id: 'story-1', theme: null };
let mockCanEdit = true;
let mockUserId: string | null = 'user-1';
const mockUseScreenTour = jest.fn();

jest.mock('../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));
jest.mock('@/src/components/common', () => ({
  __esModule: true,
  Button: ({ onPress, children }: { onPress: () => void; children?: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: `btn-${children}`, onPress }, children);
  },
  ThemePickerModal: (props: {
    visible: boolean;
    value: string;
    saving: boolean;
    onPreview: (value: string) => void;
    onConfirm: (value: string) => void;
    onClose: () => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    if (!props.visible) return null;
    return react.createElement(
      native.View,
      { testID: 'theme-picker' },
      react.createElement(native.Text, { testID: 'picker-value' }, props.value),
      react.createElement(
        native.Text,
        { testID: 'picker-preview', onPress: () => props.onPreview('ocean') },
        'preview',
      ),
      react.createElement(
        native.Text,
        { testID: 'picker-confirm', onPress: () => props.onConfirm('ocean') },
        'confirm',
      ),
      react.createElement(
        native.Text,
        { testID: 'picker-default', onPress: () => props.onConfirm('default') },
        'default',
      ),
      react.createElement(native.Text, { testID: 'picker-close', onPress: props.onClose }, 'close'),
    );
  },
}));
jest.mock('@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.View, { testID: 'keyboard-screen' }, children);
  },
}));
jest.mock('../../../src/screens/customization/ThemePreview', () => ({
  __esModule: true,
  default: () => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'theme-preview' }, 'preview');
  },
}));
jest.mock('@/src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('@/src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('@/src/hooks/useFormScrollBottomPadding', () => ({
  __esModule: true,
  useFormScrollBottomPadding: () => 0,
}));
jest.mock('@/src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('@/src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({ updateStory: mockUpdateStory }),
}));
jest.mock('@/src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStory, setSelectedStory: mockSetSelectedStory }),
}));
jest.mock('@/src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: mockUserId }),
}));
jest.mock('@/src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#eee',
      primary: '#00f',
      text: '#111',
      textSecondary: '#666',
    },
    setTheme: mockApplyTheme,
  }),
}));
jest.mock('@/src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

import StoryAppearanceScreen from '../../../src/screens/customization/StoryAppearanceScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockStory = { id: 'story-1', theme: null };
  mockCanEdit = true;
  mockUserId = 'user-1';
  mockUpdateStory.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

it('requests its guided tour', async () => {
  await render(<StoryAppearanceScreen />);

  expect(mockUseScreenTour).toHaveBeenCalledWith('StoryAppearance');
});

it('asks for a story when none is selected', async () => {
  mockStory = null;
  const view = await render(<StoryAppearanceScreen />);

  expect(view.getByText('story_not_found')).toBeTruthy();
});

it('renders the current theme with its label', async () => {
  const view = await render(<StoryAppearanceScreen />);

  expect(view.getByText('appearance_title')).toBeTruthy();
  expect(view.getByText('appearance_screen_description')).toBeTruthy();
  expect(view.getByText('theme_default_label')).toBeTruthy();
  expect(view.getByTestId('theme-preview')).toBeTruthy();
});

it('labels a stored theme', async () => {
  mockStory = { id: 'story-1', theme: 'ocean' };
  const view = await render(<StoryAppearanceScreen />);

  expect(view.getByText('theme_ocean_label')).toBeTruthy();
});

it('confirms a new theme through the picker', async () => {
  const view = await render(<StoryAppearanceScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  expect(view.getByTestId('theme-picker')).toBeTruthy();
  expect(view.getByTestId('picker-value').props.children).toBe('default');

  await fireEvent.press(view.getByTestId('picker-preview'));
  expect(mockApplyTheme).toHaveBeenCalledWith('ocean');

  await fireEvent.press(view.getByTestId('picker-confirm'));
  await waitFor(() =>
    expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', { theme: 'ocean' }),
  );
  expect(mockSetSelectedStory).toHaveBeenCalledWith({ id: 'story-1', theme: 'ocean' });
  expect(mockApplyTheme).toHaveBeenCalledWith('ocean');
  expect(view.queryByTestId('theme-picker')).toBeNull();
  expect(mockAlert).toHaveBeenCalledWith('success', 'theme_updated_successfully');
});

it('stores the default theme as null', async () => {
  mockStory = { id: 'story-1', theme: 'ocean' };
  const view = await render(<StoryAppearanceScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  await fireEvent.press(view.getByTestId('picker-default'));
  await waitFor(() =>
    expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', { theme: null }),
  );
  expect(mockSetSelectedStory).toHaveBeenCalledWith({ id: 'story-1', theme: null });
});

it('restores the theme when closing without confirming', async () => {
  mockStory = { id: 'story-1', theme: 'ocean' };
  const view = await render(<StoryAppearanceScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  await fireEvent.press(view.getByTestId('picker-close'));
  expect(view.queryByTestId('theme-picker')).toBeNull();
  expect(mockApplyTheme).toHaveBeenCalledWith('ocean');
  expect(mockUpdateStory).not.toHaveBeenCalled();
});

it('reports save failures and restores the theme', async () => {
  mockUpdateStory.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<StoryAppearanceScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  await fireEvent.press(view.getByTestId('picker-confirm'));
  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_update_theme'));
  expect(mockApplyTheme).toHaveBeenCalledWith('default');
});

it('does nothing without a user', async () => {
  mockUserId = null;
  const view = await render(<StoryAppearanceScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  await fireEvent.press(view.getByTestId('picker-confirm'));
  expect(mockUpdateStory).not.toHaveBeenCalled();
});

it('hides the picker action when read-only', async () => {
  mockCanEdit = false;
  const view = await render(<StoryAppearanceScreen />);

  expect(view.getByText('story_read_only_error')).toBeTruthy();
  expect(view.queryByTestId('btn-select_theme')).toBeNull();
});
