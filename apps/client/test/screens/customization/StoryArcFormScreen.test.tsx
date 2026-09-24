import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };
const mockGetArcById = jest.fn();
const mockUpdateArc = jest.fn();
const mockCreateArc = jest.fn();
const mockNotify = jest.fn();
const mockApplyTheme = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockAlert = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
let mockArcId: string | undefined;
let mockStory: { id: string; theme: string | null } | null = { id: 'story-1', theme: null };
let mockCanEdit = true;
let mockUserId: string | null = 'user-1';
let mockActiveArc: { themeOverride: string | null } | null = null;

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => mockNavigation,
    useRoute: () => ({ params: { arcId: mockArcId } }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('@/src/components/common', () => ({
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
      `${children}${disabled ? ' (disabled)' : ''}`,
    );
  },
  TextInput: (props: {
    value: string;
    onChangeText: (value: string) => void;
    multiline?: boolean;
    style?: StyleProp<TextStyle>;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.TextInput, {
      testID: props.multiline ? 'input-description' : 'input-title',
      value: props.value,
      onChangeText: props.onChangeText,
      style: props.style,
    });
  },
  ThemePickerModal: (props: {
    visible: boolean;
    value: string;
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
        { testID: 'picker-confirm', onPress: () => props.onConfirm('ocean') },
        'confirm',
      ),
      react.createElement(native.Text, { testID: 'picker-close', onPress: props.onClose }, 'close'),
    );
  },
}));
jest.mock('@/src/components/common/forms/EntityFormContainer/EntityFormContainer', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.View, { testID: 'form-container' }, children);
  },
}));
jest.mock('@/src/components/common/forms/FormField/FormField', () => ({
  __esModule: true,
  default: ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode | ((a11y: object) => React.ReactNode);
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: `field-${label}` },
      typeof children === 'function' ? children({}) : children,
    );
  },
}));
jest.mock('@/src/components/common/inputs/IconPickerInput/IconPickerInput', () => ({
  __esModule: true,
  default: (props: { currentIcon: string | null; onSelectIcon: (icon: string) => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'icon-picker' },
      react.createElement(
        native.Text,
        { testID: 'picker-current-icon' },
        props.currentIcon ?? 'none',
      ),
      react.createElement(
        native.Text,
        { testID: 'picker-pick', onPress: () => props.onSelectIcon('keres:castle') },
        'pick',
      ),
    );
  },
}));
jest.mock('@/src/components/common/controls/FormActions/FormActions', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.View, { testID: 'form-actions' }, children);
  },
}));
jest.mock('@/src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('@/src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('@/src/hooks/useStoryArcs', () => ({
  __esModule: true,
  useStoryArcs: () => ({ activeArc: mockActiveArc }),
}));
jest.mock('@/src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('@/src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({ term: (value: string) => value }),
}));
jest.mock('@/src/services/storymanagement/StoryArcService', () => ({
  __esModule: true,
  createStoryArcService: () => ({
    getById: mockGetArcById,
    updateArc: mockUpdateArc,
    createArc: mockCreateArc,
  }),
}));
jest.mock('@/src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: { selectedStory: unknown }) => unknown) =>
    selector({ selectedStory: mockStory }),
}));
jest.mock('@/src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: mockUserId }),
}));
jest.mock('@/src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: (selector: (state: { showNotification: unknown }) => unknown) =>
    selector({ showNotification: mockNotify }),
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
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

import StoryArcFormScreen from '../../../src/screens/customization/StoryArcFormScreen';

beforeEach(() => {
  jest.clearAllMocks();
  mockArcId = undefined;
  mockStory = { id: 'story-1', theme: null };
  mockCanEdit = true;
  mockUserId = 'user-1';
  mockActiveArc = null;
  mockGetArcById.mockResolvedValue(null);
  mockUpdateArc.mockResolvedValue({});
  mockCreateArc.mockResolvedValue({});
});

afterEach(() => {
  cleanup();
});

it('renders a blank creation form with the inherited theme', async () => {
  const view = await render(<StoryArcFormScreen />);

  expect(view.getByTestId('field-name')).toBeTruthy();
  expect(view.getByTestId('field-description')).toBeTruthy();
  expect(view.getByTestId('field-arc_icon')).toBeTruthy();
  expect(view.getByText('arc_theme_inherited')).toBeTruthy();
  expect(view.queryByTestId('btn-arc_theme_inherit')).toBeNull();
  expect(mockGetArcById).not.toHaveBeenCalled();
});

it('grows the description field with the shared multiline style', async () => {
  const view = await render(<StoryArcFormScreen />);

  // Without a minHeight the multiline field renders one line tall.
  const style = StyleSheet.flatten(view.getByTestId('input-description').props.style);
  expect(style?.minHeight).toBeGreaterThan(0);
});

type HeaderActionStub = { id: string; disabled?: boolean; onPress: () => void };

const lastHeaderActions = (): HeaderActionStub[] => {
  const calls = mockUseScreenHeader.mock.calls;
  return calls[calls.length - 1][0].actions as HeaderActionStub[];
};

const lastAlertButtons = (): { style?: string; onPress?: () => void }[] => {
  const calls = mockAlert.mock.calls;
  return calls[calls.length - 1][2] as { style?: string; onPress?: () => void }[];
};

it('exposes a disabled reset header action while the form is pristine', async () => {
  await render(<StoryArcFormScreen />);

  expect(lastHeaderActions().find((action) => action.id === 'reset-form')).toMatchObject({
    disabled: true,
  });
});

it('resets typed values back to blanks after confirm', async () => {
  const view = await render(<StoryArcFormScreen />);

  await fireEvent.changeText(view.getByTestId('input-title'), 'Rising');
  const reset = lastHeaderActions().find((action) => action.id === 'reset-form');
  expect(reset).toMatchObject({ disabled: false });
  await act(async () => {
    reset?.onPress();
  });
  const alertCalls = mockAlert.mock.calls;
  expect(alertCalls[alertCalls.length - 1][1]).toBe('form_reset_create_message');
  await act(async () => {
    lastAlertButtons()
      .find((button) => button.style === 'destructive')
      ?.onPress?.();
  });

  expect(view.getByTestId('input-title').props.value).toBe('');
  expect(lastHeaderActions().find((action) => action.id === 'reset-form')).toMatchObject({
    disabled: true,
  });
});

it('resets edited values back to the loaded arc after confirm', async () => {
  mockArcId = 'arc-1';
  mockGetArcById.mockResolvedValue({
    title: 'Prologue',
    description: 'Start',
    themeOverride: null,
  });
  const view = await render(<StoryArcFormScreen />);

  await waitFor(() => expect(view.getByTestId('input-title').props.value).toBe('Prologue'));
  await fireEvent.changeText(view.getByTestId('input-title'), 'Changed');
  const reset = lastHeaderActions().find((action) => action.id === 'reset-form');
  expect(reset).toMatchObject({ disabled: false });
  await act(async () => {
    reset?.onPress();
  });
  const alertCalls = mockAlert.mock.calls;
  expect(alertCalls[alertCalls.length - 1][1]).toBe('form_reset_edit_message');
  await act(async () => {
    lastAlertButtons()
      .find((button) => button.style === 'destructive')
      ?.onPress?.();
  });

  expect(view.getByTestId('input-title').props.value).toBe('Prologue');
  expect(view.getByTestId('input-description').props.value).toBe('Start');
});

it('creates an arc on save and goes back', async () => {
  const view = await render(<StoryArcFormScreen />);

  await fireEvent.changeText(view.getByTestId('input-title'), 'Rising');
  await fireEvent.changeText(view.getByTestId('input-description'), 'Tension');
  await fireEvent.press(view.getByTestId('btn-save'));
  await waitFor(() =>
    expect(mockCreateArc).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ storyId: 'story-1', title: 'Rising', description: 'Tension' }),
    ),
  );
  expect(mockGoBack).toHaveBeenCalled();
});

it('saves the picked icon on create', async () => {
  const view = await render(<StoryArcFormScreen />);

  await fireEvent.changeText(view.getByTestId('input-title'), 'Rising');
  await fireEvent.press(view.getByTestId('picker-pick'));
  await fireEvent.press(view.getByTestId('btn-save'));
  await waitFor(() =>
    expect(mockCreateArc).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: 'Rising', icon: 'keres:castle' }),
    ),
  );
});

it('hydrates the picked icon and updates it on save', async () => {
  mockArcId = 'arc-1';
  mockGetArcById.mockResolvedValue({
    title: 'Prologue',
    description: null,
    icon: 'flag',
    themeOverride: null,
  });
  const view = await render(<StoryArcFormScreen />);

  await waitFor(() => expect(view.getByTestId('picker-current-icon')).toBeTruthy());
  expect(view.getByTestId('picker-current-icon').props.children).toBe('flag');

  await fireEvent.press(view.getByTestId('picker-pick'));
  await fireEvent.press(view.getByTestId('btn-save'));
  await waitFor(() =>
    expect(mockUpdateArc).toHaveBeenCalledWith(
      'user-1',
      'arc-1',
      expect.objectContaining({ title: 'Prologue', icon: 'keres:castle' }),
    ),
  );
});

it('refuses to save without a title, story or user', async () => {
  const view = await render(<StoryArcFormScreen />);

  await fireEvent.press(view.getByTestId('btn-save'));
  expect(mockCreateArc).not.toHaveBeenCalled();

  await fireEvent.changeText(view.getByTestId('input-title'), '   ');
  await fireEvent.press(view.getByTestId('btn-save'));
  expect(mockCreateArc).not.toHaveBeenCalled();

  mockUserId = null;
  await fireEvent.changeText(view.getByTestId('input-title'), 'Rising');
  await fireEvent.press(view.getByTestId('btn-save'));
  expect(mockCreateArc).not.toHaveBeenCalled();
});

it('notifies when saving fails', async () => {
  mockCreateArc.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<StoryArcFormScreen />);

  await fireEvent.changeText(view.getByTestId('input-title'), 'Rising');
  await fireEvent.press(view.getByTestId('btn-save'));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('boom', 'error'));

  mockCreateArc.mockRejectedValueOnce('nope');
  await fireEvent.press(view.getByTestId('btn-save'));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('calendar_save_failed', 'error'));
});

it('hydrates and updates an existing arc', async () => {
  mockArcId = 'arc-1';
  mockGetArcById.mockResolvedValue({
    title: 'Prologue',
    description: 'Start',
    themeOverride: 'ocean',
  });
  const view = await render(<StoryArcFormScreen />);

  await waitFor(() => expect(mockGetArcById).toHaveBeenCalledWith('arc-1'));
  await waitFor(() => expect(view.getByTestId('input-title').props.value).toBe('Prologue'));
  expect(view.getByTestId('input-description').props.value).toBe('Start');
  expect(view.getByTestId('btn-arc_theme_inherit')).toBeTruthy();

  await fireEvent.changeText(view.getByTestId('input-title'), 'Prologue II');
  await fireEvent.press(view.getByTestId('btn-save'));
  await waitFor(() =>
    expect(mockUpdateArc).toHaveBeenCalledWith(
      'user-1',
      'arc-1',
      expect.objectContaining({ title: 'Prologue II', themeOverride: 'ocean' }),
    ),
  );
  expect(mockGoBack).toHaveBeenCalled();
});

it('leaves the form blank when the arc is gone', async () => {
  mockArcId = 'arc-missing';
  mockGetArcById.mockResolvedValue(null);
  const view = await render(<StoryArcFormScreen />);

  await waitFor(() => expect(mockGetArcById).toHaveBeenCalledWith('arc-missing'));
  expect(view.getByTestId('input-title').props.value).toBe('');
});

it('confirms a theme override through the picker', async () => {
  const view = await render(<StoryArcFormScreen />);

  await fireEvent.press(view.getByTestId('btn-select_theme'));
  expect(view.getByTestId('theme-picker')).toBeTruthy();
  await fireEvent.press(view.getByTestId('picker-confirm'));
  expect(view.queryByTestId('theme-picker')).toBeNull();
  expect(view.getByTestId('btn-arc_theme_inherit')).toBeTruthy();
  expect(mockApplyTheme).toHaveBeenCalled();
});

it('closes the picker and inherits the theme back', async () => {
  mockArcId = 'arc-1';
  mockGetArcById.mockResolvedValue({ title: 'P', description: null, themeOverride: 'ocean' });
  const view = await render(<StoryArcFormScreen />);

  await waitFor(() => expect(view.getByTestId('btn-arc_theme_inherit')).toBeTruthy());
  await fireEvent.press(view.getByTestId('btn-select_theme'));
  await fireEvent.press(view.getByTestId('picker-close'));
  expect(view.queryByTestId('theme-picker')).toBeNull();

  await fireEvent.press(view.getByTestId('btn-arc_theme_inherit'));
  expect(view.queryByTestId('btn-arc_theme_inherit')).toBeNull();
  expect(view.getByText('arc_theme_inherited')).toBeTruthy();
});

it('cancels back and hides actions when read-only', async () => {
  mockCanEdit = false;
  const view = await render(<StoryArcFormScreen />);

  expect(view.getByText('story_read_only_error')).toBeTruthy();
  expect(view.queryByTestId('form-actions')).toBeNull();
  expect(view.queryByTestId('btn-select_theme')).toBeNull();
  expect(view.queryByTestId('icon-picker')).toBeNull();

  mockCanEdit = true;
  const editable = await render(<StoryArcFormScreen />);
  expect(editable.getByTestId('icon-picker')).toBeTruthy();
  await fireEvent.press(editable.getByTestId('btn-cancel'));
  expect(mockGoBack).toHaveBeenCalled();
});
