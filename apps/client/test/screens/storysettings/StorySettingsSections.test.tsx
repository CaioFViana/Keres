import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigateAcross = jest.fn();
const mockResetToStorySelection = jest.fn();
const mockSetSelectedStory = jest.fn();
const mockAppAlert = jest.fn();
const mockGetStoryById = jest.fn();
const mockUpdateStory = jest.fn();
const mockDeleteStory = jest.fn();

let mockSelectedStory: { id: string; title: string } | null = { id: 'story-1', title: 'My Story' };
let mockCanEdit = true;
let mockCanManageStoryPolicy = true;

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };
const mockT = (key: string) => key;
const mockDrizzleDb = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  __esModule: true,
  useNavigation: () => mockNavigation,
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDrizzleDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));
jest.mock('../../../src/hooks/useNavigateAcrossStacks', () => ({
  __esModule: true,
  useNavigateAcrossStacks: () => mockNavigateAcross,
}));
jest.mock('../../../src/screens/storysettings/useResetToStorySelection', () => ({
  __esModule: true,
  useResetToStorySelection: () => mockResetToStorySelection,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit, canManageStoryPolicy: mockCanManageStoryPolicy }),
}));
jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  __esModule: true,
  createStoryService: () => ({
    getStoryById: mockGetStoryById,
    updateStory: mockUpdateStory,
    deleteStory: mockDeleteStory,
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
    colors: {
      error: '#f00',
      text: '#111',
      textSecondary: '#555',
      card: '#fff',
      border: '#ddd',
      background: '#fff',
      primary: '#00f',
    },
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
  };
});
jest.mock('../../../src/components/features/gallery/GalleryCoverField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      value,
      onChange,
    }: {
      value: string | null;
      onChange: (value: string | null) => void;
    }) => (
      <Text testID="cover-field" onPress={() => onChange('gallery-7')}>
        {`cover:${value}`}
      </Text>
    ),
  };
});
jest.mock(
  '../../../src/components/features/story/StoryCollaborationSection/StoryCollaborationSection',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: (props: {
        allowReaderComments: boolean;
        onAllowReaderCommentsChange: (next: boolean) => void;
        onLeftStory: () => void;
      }) => (
        <>
          <Text testID="collab-toggle" onPress={() => props.onAllowReaderCommentsChange(true)}>
            {`readers:${props.allowReaderComments}`}
          </Text>
          <Text testID="collab-leave" onPress={props.onLeftStory}>
            leave
          </Text>
        </>
      ),
    };
  },
);
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: () => <Text testID="screen-loading">loading</Text>,
    ScreenError: ({ message }: { message: string }) => <Text testID="screen-error">{message}</Text>,
  };
});
jest.mock('../../../src/components/common/forms/EntityFormContainer/EntityFormContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      title,
      actions,
      children,
    }: {
      title: string;
      actions?: ReactNode;
      children?: ReactNode;
    }) => (
      <>
        <Text testID="form-title">{title}</Text>
        {actions}
        {children}
      </>
    ),
  };
});
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

import StorySettingsAppearanceScreen from '../../../src/screens/storysettings/StorySettingsAppearanceScreen';
import StorySettingsCollaborationScreen from '../../../src/screens/storysettings/StorySettingsCollaborationScreen';
import StorySettingsIndexScreen from '../../../src/screens/storysettings/StorySettingsIndexScreen';

function alertButtons(callIndex: number): { text: string; onPress?: () => void }[] {
  return mockAppAlert.mock.calls[callIndex][2] as { text: string; onPress?: () => void }[];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectedStory = { id: 'story-1', title: 'My Story' };
  mockCanEdit = true;
  mockCanManageStoryPolicy = true;
  mockGetStoryById.mockResolvedValue({
    id: 'story-1',
    coverGalleryId: 'gallery-1',
    allowReaderComments: false,
  });
  mockUpdateStory.mockResolvedValue(undefined);
  mockDeleteStory.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('StorySettingsIndexScreen', () => {
  it('opens each section of its own, and the customization screens it borrows', async () => {
    const view = await render(<StorySettingsIndexScreen />);

    await fireEvent.press(view.getByTestId('story-settings-general'));
    expect(mockNavigate).toHaveBeenLastCalledWith('StorySettingsGeneral');
    await fireEvent.press(view.getByTestId('story-settings-appearance'));
    expect(mockNavigate).toHaveBeenLastCalledWith('StorySettingsAppearance');
    await fireEvent.press(view.getByTestId('story-settings-collaboration'));
    expect(mockNavigate).toHaveBeenLastCalledWith('StorySettingsCollaboration');

    await fireEvent.press(view.getByTestId('story-settings-vocabulary'));
    expect(mockNavigateAcross).toHaveBeenLastCalledWith('CustomizationStack', 'Vocabulary');
    await fireEvent.press(view.getByTestId('story-settings-schema'));
    expect(mockNavigateAcross).toHaveBeenLastCalledWith('CustomizationStack', 'StorySchemaList');
    await fireEvent.press(view.getByTestId('story-settings-suggestions'));
    expect(mockNavigateAcross).toHaveBeenLastCalledWith('CustomizationStack', 'Suggestions');
  });

  it('offers no server section in a serverless build', async () => {
    process.env.EXPO_PUBLIC_SERVERLESS = '1';
    try {
      const view = await render(<StorySettingsIndexScreen />);
      expect(view.queryByTestId('story-settings-collaboration')).toBeNull();
      expect(view.getByTestId('story-settings-general')).toBeTruthy();
    } finally {
      delete process.env.EXPO_PUBLIC_SERVERLESS;
    }
  });

  it('deletes the story after confirmation and leaves for story selection', async () => {
    const view = await render(<StorySettingsIndexScreen />);
    await fireEvent.press(view.getByTestId('btn-delete_story_title'));
    expect(mockAppAlert).toHaveBeenCalledWith(
      'delete_story_title',
      'delete_story_message',
      expect.any(Array),
    );
    const remove = alertButtons(0).find((button) => button.text === 'delete');
    await act(async () => {
      await remove!.onPress!();
    });
    await waitFor(() => expect(mockDeleteStory).toHaveBeenCalledWith('story-1'));
    expect(mockAppAlert).toHaveBeenCalledWith('success', 'story_deleted_successfully');
    expect(mockResetToStorySelection).toHaveBeenCalledTimes(1);
  });

  it('leaves the delete button off for anyone who does not own the story', async () => {
    mockCanManageStoryPolicy = false;
    const view = await render(<StorySettingsIndexScreen />);
    expect(view.getByTestId('btn-delete_story_title').props.children).toBe(
      'delete_story_title:disabled',
    );
    expect(view.getByText('story_owner_only_error')).toBeTruthy();
  });
});

describe('StorySettingsAppearanceScreen', () => {
  it('saves only the cover and goes back', async () => {
    const view = await render(<StorySettingsAppearanceScreen />);
    await waitFor(() => expect(view.getByTestId('cover-field').props.children).toBe('cover:gallery-1'));

    await fireEvent.press(view.getByTestId('cover-field'));
    await fireEvent.press(view.getByTestId('btn-update_story'));

    await waitFor(() => expect(mockUpdateStory).toHaveBeenCalled());
    expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
      coverGalleryId: 'gallery-7',
    });
    expect(mockSetSelectedStory).toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('opens the theme screen and comes back here', async () => {
    const view = await render(<StorySettingsAppearanceScreen />);
    await waitFor(() => expect(view.queryByTestId('story-settings-theme')).not.toBeNull());
    await fireEvent.press(view.getByTestId('story-settings-theme'));
    expect(mockNavigateAcross).toHaveBeenCalledWith('CustomizationStack', 'StoryAppearance');
  });

  it('does not let a reader save', async () => {
    mockCanEdit = false;
    const view = await render(<StorySettingsAppearanceScreen />);
    await waitFor(() => expect(view.queryByTestId('btn-update_story')).not.toBeNull());
    expect(view.getByTestId('btn-update_story').props.children).toBe('update_story:disabled');
  });
});

describe('StorySettingsCollaborationScreen', () => {
  it('saves only whether readers may comment', async () => {
    const view = await render(<StorySettingsCollaborationScreen />);
    await waitFor(() => expect(view.queryByTestId('collab-toggle')).not.toBeNull());

    await fireEvent.press(view.getByTestId('collab-toggle'));
    await fireEvent.press(view.getByTestId('btn-update_story'));

    await waitFor(() => expect(mockUpdateStory).toHaveBeenCalled());
    expect(mockUpdateStory).toHaveBeenCalledWith('user-1', 'story-1', {
      allowReaderComments: true,
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('leaves for story selection when the person leaves the story', async () => {
    const view = await render(<StorySettingsCollaborationScreen />);
    await waitFor(() => expect(view.queryByTestId('collab-leave')).not.toBeNull());
    await fireEvent.press(view.getByTestId('collab-leave'));
    expect(mockResetToStorySelection).toHaveBeenCalledTimes(1);
  });

  it('keeps the save for the owner and says so to a writer', async () => {
    mockCanManageStoryPolicy = false;
    const view = await render(<StorySettingsCollaborationScreen />);
    await waitFor(() => expect(view.queryByTestId('btn-update_story')).not.toBeNull());
    expect(view.getByTestId('btn-update_story').props.children).toBe('update_story:disabled');
    expect(view.getByText('story_owner_only_error')).toBeTruthy();
  });

  it('says so when the story cannot be read', async () => {
    mockGetStoryById.mockResolvedValue(null);
    const view = await render(<StorySettingsCollaborationScreen />);
    await waitFor(() => expect(view.queryByTestId('screen-error')).not.toBeNull());
    expect(view.getByTestId('screen-error').props.children).toBe('story_not_found');
  });
});
