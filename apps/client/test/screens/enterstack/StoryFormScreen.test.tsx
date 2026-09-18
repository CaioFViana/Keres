const mockT = (key: string) => key;
const mockI18n = { t: mockT, i18n: { language: 'en' } };
const mockAlert = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = { goBack: (...args: unknown[]) => mockGoBack(...args) };
const mockRoute: { params?: { storyId?: string } } = { params: {} };
const mockDrizzle = {};
const mockGetStoryById = jest.fn();
const mockCreateStory = jest.fn();
const mockUpdateStory = jest.fn();
const mockDeleteStory = jest.fn();
const mockListPacks = jest.fn();
const mockFindConflicts = jest.fn();
const mockCreateStoryWithPacks = jest.fn();
const mockStoryRole = { role: null, canEdit: true, canManageStoryPolicy: true, loading: false };
const mockUserSettings = { userId: 'user-1' as string | null };
const mockSetTheme = jest.fn();
const mockColors = {
  primary: '#0000ff',
  onPrimary: '#ffffff',
  primaryContainer: '#e0e0ff',
  onPrimaryContainer: '#000088',
  secondary: '#00aa00',
  onSecondary: '#ffffff',
  text: '#111111',
  textSecondary: '#555555',
  background: '#ffffff',
  surface: '#f5f5f5',
  border: '#cccccc',
  error: '#ff0000',
  onError: '#ffffff',
  accent: '#ff8800',
  onAccent: '#000000',
  notification: '#00aaff',
  onNotification: '#000000',
  shadow: '#000000',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => mockI18n,
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('../../../src/theme', () => {
  const actual = jest.requireActual('../../../src/theme');
  return {
    ...actual,
    useTheme: () => ({ isDarkMode: false, setTheme: mockSetTheme, colors: mockColors }),
  };
});

jest.mock('../../../src/hooks/useScreenHeader', () => ({
  useScreenHeader: () => {},
}));

jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  useBackButtonHandler: () => {},
}));

jest.mock('../../../src/hooks/useFormScrollBottomPadding', () => ({
  useFormScrollBottomPadding: () => 20,
}));

jest.mock('../../../src/hooks/useStoryRole', () => ({
  useStoryRole: () => mockStoryRole,
}));

jest.mock('../../../src/db', () => ({
  useDrizzle: () => mockDrizzle,
}));

jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('../../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: (selector?: (state: unknown) => unknown) =>
    typeof selector === 'function' ? selector(mockUserSettings) : mockUserSettings,
}));

jest.mock('../../../src/services/storymanagement/StoryService', () => ({
  createStoryService: () => ({
    getStoryById: (...args: unknown[]) => mockGetStoryById(...args),
    createStory: (...args: unknown[]) => mockCreateStory(...args),
    updateStory: (...args: unknown[]) => mockUpdateStory(...args),
    deleteStory: (...args: unknown[]) => mockDeleteStory(...args),
  }),
}));

jest.mock('../../../src/services/storymanagement/PackService', () => ({
  createPackService: () => ({
    listPacks: (...args: unknown[]) => mockListPacks(...args),
    findConflicts: (...args: unknown[]) => mockFindConflicts(...args),
    createStoryWithPacks: (...args: unknown[]) => mockCreateStoryWithPacks(...args),
  }),
}));

type FieldsProps = {
  title: string;
  type: string;
  onTitleChange: (value: string) => void;
  typeDisabled?: boolean;
  favoriteBehaviorDisabled?: boolean;
  editable?: boolean;
};

jest.mock('../../../src/components/features/story/StoryFieldsForm/StoryFieldsForm', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: FieldsProps) => (
      <>
        <Text testID="story-fields">
          {JSON.stringify({
            title: props.title,
            type: props.type,
            typeDisabled: !!props.typeDisabled,
            favDisabled: !!props.favoriteBehaviorDisabled,
            editable: props.editable !== false,
          })}
        </Text>
        <Text testID="set-title" onPress={() => props.onTitleChange('Epic')}>
          set-title
        </Text>
      </>
    ),
  };
});

type PillProps = {
  options: Array<{ label: string; value: string }>;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
};

jest.mock('../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: PillProps) => (
      <>
        <Text testID="packs-pill">
          {JSON.stringify({
            selected: props.selectedValues,
            options: props.options.map((o) => o.value),
          })}
        </Text>
        {props.options.map((option) => (
          <Text
            key={option.value}
            testID={`pack-${option.value}`}
            onPress={() => props.onSelectionChange([...props.selectedValues, option.value])}
          >
            {option.label}
          </Text>
        ))}
      </>
    ),
  };
});

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import StoryFormScreen from '../../../src/screens/enterstack/StoryFormScreen';

const storedStory = {
  title: 'Stored',
  type: 'linear',
  description: null,
  genre: null,
  language: null,
  author: null,
  isFavorite: false,
  favoriteBehavior: 'individual',
  extraNotes: null,
};

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

describe('StoryFormScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoute.params = {};
    mockStoryRole.canEdit = true;
    mockStoryRole.canManageStoryPolicy = true;
    mockUserSettings.userId = 'user-1';
    mockGetStoryById.mockResolvedValue(storedStory);
    mockCreateStory.mockResolvedValue({ id: 'story-1' });
    mockUpdateStory.mockResolvedValue(undefined);
    mockDeleteStory.mockResolvedValue(undefined);
    mockListPacks.mockResolvedValue([{ id: 'pack-1', name: 'Heroes' }]);
    mockFindConflicts.mockResolvedValue([]);
    mockCreateStoryWithPacks.mockResolvedValue('story-1');
  });

  afterEach(() => {
    cleanup();
  });

  it('creates a story with selected packs', async () => {
    const view = await render(<StoryFormScreen />);
    await view.findByText('create_story');
    expect(view.getByText('packs_apply_hint')).toBeTruthy();
    expect(JSON.parse(view.getByTestId('packs-pill').props.children as string)).toEqual({
      selected: [],
      options: ['pack-1'],
    });
    await fireEvent.press(view.getByTestId('set-title'));
    await fireEvent.press(view.getByTestId('pack-pack-1'));
    await fireEvent.press(view.getByText('create_story'));
    await waitFor(() => expect(mockCreateStoryWithPacks).toHaveBeenCalled());
    expect(mockFindConflicts).toHaveBeenCalledWith(['pack-1']);
    expect(mockCreateStory).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalledWith('success', 'story_created_successfully');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('creates a plain story without packs', async () => {
    mockListPacks.mockResolvedValue([]);
    const view = await render(<StoryFormScreen />);
    await view.findByText('create_story');
    expect(view.getByText('packs_apply_none')).toBeTruthy();
    await fireEvent.press(view.getByTestId('set-title'));
    await fireEvent.press(view.getByText('create_story'));
    await waitFor(() =>
      expect(mockCreateStory).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ title: 'Epic', type: 'linear' }),
      ),
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('requires a title before saving', async () => {
    const view = await render(<StoryFormScreen />);
    await view.findByText('create_story');
    await fireEvent.press(view.getByText('create_story'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'title_required'));
    expect(mockCreateStory).not.toHaveBeenCalled();
  });

  it('shows the error screen when creation fails', async () => {
    mockCreateStory.mockRejectedValue(new Error('boom'));
    const view = await render(<StoryFormScreen />);
    await view.findByText('create_story');
    await fireEvent.press(view.getByTestId('set-title'));
    await fireEvent.press(view.getByText('create_story'));
    await view.findByText('failed_to_save_story');
    await fireEvent.press(view.getByText('go_back'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('edits and deletes an existing story', async () => {
    mockRoute.params = { storyId: 'story-1' };
    const view = await render(<StoryFormScreen />);
    await view.findByText('update_story');
    expect(JSON.parse(view.getByTestId('story-fields').props.children as string)).toMatchObject({
      title: 'Stored',
      typeDisabled: true,
    });
    expect(view.queryByText('packs_apply_title')).toBeNull();
    await fireEvent.press(view.getByTestId('set-title'));
    await fireEvent.press(view.getByText('update_story'));
    await waitFor(() =>
      expect(mockUpdateStory).toHaveBeenCalledWith(
        'user-1',
        'story-1',
        expect.objectContaining({ title: 'Epic' }),
      ),
    );
    expect(mockAlert).toHaveBeenCalledWith('success', 'story_updated_successfully');

    await fireEvent.press(view.getByText('delete_story_title'));
    const del = (mockAlert.mock.calls[mockAlert.mock.calls.length - 1][2] as AlertButton[]).find(
      (b) => b.text === 'delete',
    );
    await act(async () => {
      await del?.onPress?.();
    });
    await waitFor(() => expect(mockDeleteStory).toHaveBeenCalledWith('story-1'));
    expect(mockAlert).toHaveBeenCalledWith('success', 'story_deleted_successfully');
  });

  it('locks the form for readers and policy for writers', async () => {
    mockRoute.params = { storyId: 'story-1' };
    mockStoryRole.canEdit = false;
    mockStoryRole.canManageStoryPolicy = false;
    const reader = await render(<StoryFormScreen />);
    await reader.findByText('story_read_only_error');
    expect(JSON.parse(reader.getByTestId('story-fields').props.children as string)).toMatchObject({
      editable: false,
    });
    await fireEvent.press(reader.getByText('update_story'));
    expect(mockUpdateStory).not.toHaveBeenCalled();

    mockStoryRole.canEdit = true;
    const writer = await render(<StoryFormScreen />);
    await writer.findByText('story_owner_only_error');
    await fireEvent.press(writer.getByText('delete_story_title'));
    expect(mockAlert).not.toHaveBeenCalledWith(
      'delete_story_title',
      'delete_story_message',
      expect.any(Array),
      { cancelable: true },
    );
  });
});
