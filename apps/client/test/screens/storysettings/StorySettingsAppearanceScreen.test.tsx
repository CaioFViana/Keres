import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockUpdateStory = jest.fn();
const mockSetSelectedStory = jest.fn();
const mockApplyTheme = jest.fn();
const mockAlert = jest.fn();
const mockSave = jest.fn();
const mockGoBack = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
let mockStory: { id: string; theme: string | null } | null = { id: 'story-1', theme: null };
let mockCanEdit = true;
let mockUserId: string | null = 'user-1';

jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  __esModule: true,
  useNavigation: () => ({ goBack: mockGoBack }),
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));
jest.mock('../../../src/components/common', () => ({
  __esModule: true,
  Button: ({
    onPress,
    disabled,
    children,
  }: {
    onPress: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.Text,
      { testID: `btn-${children}`, onPress: disabled ? undefined : onPress },
      `${children}${disabled ? ':disabled' : ''}`,
    );
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
jest.mock('../../../src/components/common/forms/EntityFormContainer/EntityFormContainer', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      description,
      actions,
      children,
      planUsage,
    }: {
      title: string;
      description?: string;
      actions?: React.ReactNode;
      children?: React.ReactNode;
      planUsage?: boolean;
    }) =>
      react.createElement(
        native.View,
        { testID: `form-plan-usage-${String(planUsage)}` },
        react.createElement(native.Text, null, title),
        react.createElement(native.Text, null, description),
        actions,
        children,
      ),
  };
});
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    ScreenLoading: () => react.createElement(native.Text, null, 'loading'),
    ScreenError: ({ message }: { message: string }) =>
      react.createElement(native.Text, { testID: 'screen-error' }, message),
  };
});
jest.mock('../../../src/components/features/gallery/GalleryCoverField', () => {
  const react = jest.requireActual('react') as typeof import('react');
  const native = jest.requireActual('react-native') as typeof import('react-native');
  return {
    __esModule: true,
    default: ({
      value,
      onChange,
    }: {
      value: string | null;
      onChange: (value: string | null) => void;
    }) =>
      react.createElement(
        native.Text,
        { testID: 'cover-field', onPress: () => onChange('gallery-7') },
        `cover:${value}`,
      ),
  };
});
jest.mock('../../../src/screens/storysettings/ThemePreview', () => ({
  __esModule: true,
  default: () => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'theme-preview' }, 'preview');
  },
}));
jest.mock('../../../src/screens/storysettings/useLoadedStory', () => ({
  __esModule: true,
  useLoadedStory: (onLoad: (story: unknown) => void) => {
    const react = jest.requireActual('react') as typeof import('react');
    react.useEffect(() => {
      onLoad({ coverGalleryId: 'gallery-1' });
    }, [onLoad]);
    return { loading: false, error: null };
  },
}));
jest.mock('../../../src/screens/storysettings/useStorySettingsSave', () => ({
  __esModule: true,
  useStorySettingsSave: () => ({ saving: false, save: mockSave }),
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({ updateStory: mockUpdateStory }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockStory, setSelectedStory: mockSetSelectedStory }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: mockUserId }),
}));
jest.mock('../../../src/theme', () => ({
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
jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

import StorySettingsAppearanceScreen from '../../../src/screens/storysettings/StorySettingsAppearanceScreen';

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

it('says so when no story is selected', async () => {
  mockStory = null;
  const view = await render(<StorySettingsAppearanceScreen />);

  expect(view.getByTestId('screen-error').props.children).toBe('no_story_selected_for_settings');
});

it('is not a story form: it keeps the form tour and the plan banner away', async () => {
  const view = await render(<StorySettingsAppearanceScreen />);

  expect(view.getByTestId('form-plan-usage-false')).toBeTruthy();
});

it('renders the current theme with its label', async () => {
  const view = await render(<StorySettingsAppearanceScreen />);

  expect(view.getByText('appearance_title')).toBeTruthy();
  expect(view.getByText('theme_default_label')).toBeTruthy();
  expect(view.getByTestId('theme-preview')).toBeTruthy();
});

it('labels a stored theme', async () => {
  mockStory = { id: 'story-1', theme: 'ocean' };
  const view = await render(<StorySettingsAppearanceScreen />);

  expect(view.getByText('theme_ocean_label')).toBeTruthy();
});

it('saves only the cover with its own button', async () => {
  const view = await render(<StorySettingsAppearanceScreen />);
  await waitFor(() =>
    expect(view.getByTestId('cover-field').props.children).toBe('cover:gallery-1'),
  );

  await fireEvent.press(view.getByTestId('cover-field'));
  await fireEvent.press(view.getByTestId('btn-update_story'));

  expect(mockSave).toHaveBeenCalledWith({ coverGalleryId: 'gallery-7' });
  expect(mockUpdateStory).not.toHaveBeenCalled();
});

it('confirms a new theme through the picker', async () => {
  const view = await render(<StorySettingsAppearanceScreen />);

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
  expect(view.queryByTestId('theme-picker')).toBeNull();
  expect(mockAlert).toHaveBeenCalledWith('success', 'theme_updated_successfully');
});

it('stores the default theme as null', async () => {
  mockStory = { id: 'story-1', theme: 'ocean' };
  const view = await render(<StorySettingsAppearanceScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  await fireEvent.press(view.getByTestId('picker-default'));
  await waitFor(() =>
    expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', { theme: null }),
  );
  expect(mockSetSelectedStory).toHaveBeenCalledWith({ id: 'story-1', theme: null });
});

it('restores the theme when closing without confirming', async () => {
  mockStory = { id: 'story-1', theme: 'ocean' };
  const view = await render(<StorySettingsAppearanceScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  await fireEvent.press(view.getByTestId('picker-close'));
  expect(view.queryByTestId('theme-picker')).toBeNull();
  expect(mockApplyTheme).toHaveBeenCalledWith('ocean');
  expect(mockUpdateStory).not.toHaveBeenCalled();
});

it('reports save failures and restores the theme', async () => {
  mockUpdateStory.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<StorySettingsAppearanceScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  await fireEvent.press(view.getByTestId('picker-confirm'));
  await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'failed_to_update_theme'));
  expect(mockApplyTheme).toHaveBeenCalledWith('default');
});

it('does nothing without a user', async () => {
  mockUserId = null;
  const view = await render(<StorySettingsAppearanceScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  await fireEvent.press(view.getByTestId('picker-confirm'));
  expect(mockUpdateStory).not.toHaveBeenCalled();
});

it('hides the theme picker and the cover save from a reader', async () => {
  mockCanEdit = false;
  const view = await render(<StorySettingsAppearanceScreen />);

  expect(view.getByText('story_read_only_error')).toBeTruthy();
  expect(view.queryByTestId('btn-select_theme')).toBeNull();
  expect(view.getByTestId('btn-update_story').props.children).toBe('update_story:disabled');
});
