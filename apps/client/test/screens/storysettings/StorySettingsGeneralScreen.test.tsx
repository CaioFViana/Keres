import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockGoBack = jest.fn();
const mockSetSelectedStory = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockAppAlert = jest.fn();
const mockGetStoryById = jest.fn();
const mockUpdateStory = jest.fn();
const mockConvertStoryType = jest.fn();
const mockCheckLinearCompatibility = jest.fn();

let mockSelectedStory: { id: string; title: string } | null = {
  id: 'story-1',
  title: 'My Story',
};
let mockCanEdit = true;
let mockCanManageStoryPolicy = true;

// Stable identities for the loader effect.
const mockNavigation = {
  goBack: mockGoBack,
};
const mockT = (key: string) => key;
const mockDrizzleDb = {};

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    __esModule: true,
    useNavigation: () => mockNavigation,
  };
});
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDrizzleDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => mockUseScreenHeader(config),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({
    canEdit: mockCanEdit,
    canManageStoryPolicy: mockCanManageStoryPolicy,
  }),
}));
jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({
    getStoryById: mockGetStoryById,
    updateStory: mockUpdateStory,
    convertStoryType: mockConvertStoryType,
    checkLinearCompatibility: mockCheckLinearCompatibility,
  }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector?: (state: unknown) => unknown) => {
    const state = { selectedStory: mockSelectedStory, setSelectedStory: mockSetSelectedStory };
    return selector ? selector(state) : state;
  },
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: { error: '#f00', text: '#111', textSecondary: '#555', card: '#fff', border: '#ddd' },
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAppAlert(...args) },
}));
jest.mock('../../../src/components/common', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    Button: ({
      onPress,
      disabled,
      children,
    }: {
      onPress: () => void;
      disabled?: boolean;
      children?: ReactNode;
    }) => (
      <Text testID={`btn-${children}`} onPress={disabled ? undefined : onPress}>
        {`${children}:${disabled ? 'disabled' : 'enabled'}`}
      </Text>
    ),
    SingleSelectPill: ({
      options,
      value,
      onValueChange,
      disabled,
    }: {
      options: { label: string; value: string }[];
      value: string;
      onValueChange: (next: string) => void;
      disabled?: boolean;
    }) => (
      <>
        <Text testID="favorite-behavior">
          {JSON.stringify({
            value,
            disabled: !!disabled,
            options: options.map((o) => o.value),
          })}
        </Text>
        <Text testID="favorite-behavior-change" onPress={() => onValueChange('global')}>
          change
        </Text>
      </>
    ),
  };
});
jest.mock('../../../src/components/common/controls/ThemedSwitch/ThemedSwitch', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      value,
      onValueChange,
      disabled,
    }: {
      value: boolean;
      onValueChange: (next: boolean) => void;
      disabled?: boolean;
    }) => (
      <Text testID="themed-switch" onPress={disabled ? undefined : () => onValueChange(!value)}>
        {`${value}:${disabled ? 'disabled' : 'enabled'}`}
      </Text>
    ),
  };
});
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: () => <Text testID="screen-loading">loading</Text>,
    ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => (
      <Text testID="screen-error" onPress={onGoBack}>
        {message}
      </Text>
    ),
  };
});
jest.mock('../../../src/components/common/forms/EntityFormContainer/EntityFormContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      description,
      actions,
      children,
    }: {
      title: string;
      description?: string;
      actions?: ReactNode;
      children?: ReactNode;
    }) => (
      <>
        <Text testID="form-title">{title}</Text>
        <Text testID="form-description">{description}</Text>
        {actions}
        {children}
      </>
    ),
  };
});
jest.mock('../../../src/components/features/story/StoryFieldsForm/StoryFieldsForm', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      title: string;
      type: string;
      editable?: boolean;
      typeDisabled?: boolean;
      onTitleChange: (next: string) => void;
      onTypeChange: (next: 'linear' | 'branching') => void;
    }) => (
      <>
        <Text testID="identity-marker">
          {JSON.stringify({
            title: props.title,
            type: props.type,
            editable: props.editable,
            typeDisabled: props.typeDisabled,
          })}
        </Text>
        <Text testID="identity-clear-title" onPress={() => props.onTitleChange('   ')}>
          clear
        </Text>
        <Text
          testID="identity-change-type"
          onPress={() => props.onTypeChange(props.type === 'linear' ? 'branching' : 'linear')}
        >
          change-type
        </Text>
      </>
    ),
  };
});
jest.mock('react-i18next', () => {
  const actual = jest.requireActual('react-i18next');
  return {
    ...actual,
    __esModule: true,
    useTranslation: () => ({ t: mockT }),
  };
});

import StorySettingsGeneralScreen from '../../../src/screens/storysettings/StorySettingsGeneralScreen';

function makeStory(overrides = {}) {
  return {
    id: 'story-1',
    userId: 'user-1',
    title: 'My Story',
    type: 'linear',
    description: null,
    genre: null,
    language: null,
    author: null,
    isFavorite: false,
    favoriteBehavior: 'individual',
    extraNotes: null,
    normalizeSceneTiming: true,
    allowReaderComments: false,
    autoLinkMentions: true,
    ...overrides,
  };
}

type View = {
  getByTestId: (id: string) => { props: { children?: unknown } };
  getAllByTestId: (id: string) => { props: { children?: unknown } }[];
};

function jsonOf(view: View, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

function alertButtons(callIndex: number): { text: string; onPress?: () => void }[] {
  return mockAppAlert.mock.calls[callIndex][2] as {
    text: string;
    onPress?: () => void;
  }[];
}

describe('StorySettingsGeneralScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedStory = { id: 'story-1', title: 'My Story' };
    mockCanEdit = true;
    mockCanManageStoryPolicy = true;
    mockGetStoryById.mockResolvedValue(makeStory());
    mockUpdateStory.mockResolvedValue(undefined);
    mockConvertStoryType.mockResolvedValue(undefined);
    mockCheckLinearCompatibility.mockResolvedValue({ compatible: true, reasons: [] });
  });

  it('loads the story into the settings form', async () => {
    const view = await render(<StorySettingsGeneralScreen />);
    await waitFor(() => expect(mockGetStoryById).toHaveBeenCalledWith('story-1', 'user-1'));
    await waitFor(() => expect(view.queryByTestId('form-title')).not.toBeNull());
    expect(view.getByTestId('form-title').props.children).toBe('story_settings_section_general');
    expect(jsonOf(view, 'identity-marker')).toMatchObject({
      title: 'My Story',
      type: 'linear',
      editable: true,
      typeDisabled: false,
    });
    // normalizeSceneTiming=true, autoLinkMentions=true from the story; the adults-only
    // switch comes first and stays off for an old story without the flag.
    expect(view.getAllByTestId('themed-switch')[0].props.children).toBe('false:enabled');
    expect(view.getAllByTestId('themed-switch')[1].props.children).toBe('true:enabled');
    expect(view.getAllByTestId('themed-switch')[2].props.children).toBe('true:enabled');
    expect(jsonOf(view, 'favorite-behavior')).toMatchObject({
      value: 'individual',
      disabled: false,
      options: ['global', 'individual', 'individual_public'],
    });
    expect(view.getByTestId('btn-update_story').props.children).toBe('update_story:enabled');
  });

  it('saves only its own fields and goes back', async () => {
    const view = await render(<StorySettingsGeneralScreen />);
    await waitFor(() => expect(view.queryByTestId('form-title')).not.toBeNull());
    // Flip both preference switches (the adults-only one comes first) before saving.
    await fireEvent.press(view.getAllByTestId('themed-switch')[1]);
    await fireEvent.press(view.getAllByTestId('themed-switch')[2]);
    await fireEvent.press(view.getByTestId('favorite-behavior-change'));
    await fireEvent.press(view.getByTestId('btn-update_story'));
    await waitFor(() => expect(mockUpdateStory).toHaveBeenCalled());
    expect(mockUpdateStory).toHaveBeenCalledWith(
      'user-1',
      'story-1',
      expect.objectContaining({
        title: 'My Story',
        normalizeSceneTiming: false,
        autoLinkMentions: false,
        favoriteBehavior: 'global',
        isNsfw: false,
      }),
    );
    // The cover and the collaboration setting belong to other sections and are never written from here.
    const written = mockUpdateStory.mock.calls[0][2];
    expect(written).not.toHaveProperty('coverGalleryId');
    expect(written).not.toHaveProperty('allowReaderComments');
    expect(mockSetSelectedStory).toHaveBeenCalled();
    expect(mockAppAlert).toHaveBeenCalledWith('success', 'story_updated_successfully');
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('confirms before flagging adults-only, and saves only on confirm', async () => {
    const view = await render(<StorySettingsGeneralScreen />);
    await waitFor(() => expect(view.queryByTestId('form-title')).not.toBeNull());
    await fireEvent.press(view.getAllByTestId('themed-switch')[0]);
    await fireEvent.press(view.getByTestId('btn-update_story'));

    await waitFor(() =>
      expect(mockAppAlert).toHaveBeenCalledWith(
        'story_nsfw_confirm_title',
        'story_nsfw_confirm_message',
        expect.any(Array),
      ),
    );
    expect(mockUpdateStory).not.toHaveBeenCalled();

    const confirm = alertButtons(0).find((button) => button.text === 'confirm');
    await confirm!.onPress!();
    await waitFor(() => expect(mockUpdateStory).toHaveBeenCalled());
    expect(mockUpdateStory).toHaveBeenCalledWith(
      'user-1',
      'story-1',
      expect.objectContaining({ isNsfw: true }),
    );
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('requires a title before saving', async () => {
    const view = await render(<StorySettingsGeneralScreen />);
    await waitFor(() => expect(view.queryByTestId('form-title')).not.toBeNull());
    await fireEvent.press(view.getByTestId('identity-clear-title'));
    await fireEvent.press(view.getByTestId('btn-update_story'));
    await waitFor(() => expect(mockAppAlert).toHaveBeenCalledWith('error', 'title_required'));
    expect(mockUpdateStory).not.toHaveBeenCalled();
  });

  it('converts a linear story to branching after confirmation', async () => {
    const view = await render(<StorySettingsGeneralScreen />);
    await waitFor(() => expect(view.queryByTestId('form-title')).not.toBeNull());
    await fireEvent.press(view.getByTestId('identity-change-type'));
    expect(mockAppAlert).toHaveBeenCalledWith(
      'convert_to_branching_title',
      'convert_to_branching_message',
      expect.any(Array),
    );
    const convert = alertButtons(0).find((button) => button.text === 'convert');
    await convert!.onPress!();
    await waitFor(() =>
      expect(mockConvertStoryType).toHaveBeenCalledWith('user-1', 'story-1', 'branching'),
    );
    await waitFor(() => expect(jsonOf(view, 'identity-marker').type).toBe('branching'));
  });

  it('refuses the linear conversion for incompatible stories', async () => {
    mockGetStoryById.mockResolvedValue(makeStory({ type: 'branching' }));
    mockCheckLinearCompatibility.mockResolvedValue({
      compatible: false,
      reasons: [{ chapterName: 'Arrival', kind: 'fork' }],
    });
    const view = await render(<StorySettingsGeneralScreen />);
    await waitFor(() => expect(view.queryByTestId('form-title')).not.toBeNull());
    await fireEvent.press(view.getByTestId('identity-change-type'));
    await waitFor(() =>
      expect(mockAppAlert).toHaveBeenCalledWith(
        'cannot_convert_to_linear_title',
        expect.stringContaining('Arrival'),
      ),
    );
    expect(mockConvertStoryType).not.toHaveBeenCalled();
  });

  it('shows the read-only notice for writers without policy rights', async () => {
    mockCanEdit = true;
    mockCanManageStoryPolicy = false;
    const view = await render(<StorySettingsGeneralScreen />);
    await waitFor(() => expect(view.queryByTestId('form-title')).not.toBeNull());
    expect(view.getByText('story_owner_only_error')).toBeTruthy();
    expect(jsonOf(view, 'favorite-behavior').disabled).toBe(true);
  });

  it('shows an error when no story is selected', async () => {
    mockSelectedStory = null;
    const view = await render(<StorySettingsGeneralScreen />);
    expect(view.getByTestId('screen-error').props.children).toBe('no_story_selected_for_settings');
    await fireEvent.press(view.getByTestId('screen-error'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockGetStoryById).not.toHaveBeenCalled();
  });

  it('shows an error when the story cannot be loaded', async () => {
    mockGetStoryById.mockResolvedValue(null);
    const view = await render(<StorySettingsGeneralScreen />);
    await waitFor(() => expect(view.queryByTestId('screen-error')).not.toBeNull());
    expect(view.getByTestId('screen-error').props.children).toBe('story_not_found');
  });
});
