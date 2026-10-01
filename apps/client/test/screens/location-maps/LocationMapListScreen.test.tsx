import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNotify = jest.fn();
const mockGetMapsForStory = jest.fn();
const mockCreateMap = jest.fn();
const mockUpdateMap = jest.fn();
const mockDeleteMap = jest.fn();
const mockAlert = jest.fn();
const mockConfirmDelete = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
let mockStoryId: string | undefined = 'story-1';
let mockCanEdit = true;
let mockUserId: string | null = 'user-1';

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('@/src/components/common/feedback/ScreenState/ScreenState', () => ({
  __esModule: true,
  ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-error', onPress: onGoBack }, message);
  },
}));
jest.mock('@/src/components/common/inputs/TextInput/TextInput', () => ({
  __esModule: true,
  default: (props: { value: string; onChangeText: (value: string) => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.TextInput, {
      testID: 'search-input',
      value: props.value,
      onChangeText: props.onChangeText,
    });
  },
}));
jest.mock('@/src/components/features/location-maps/LocationMapCreateModal', () => ({
  __esModule: true,
  default: (props: {
    visible: boolean;
    initialValues?: { name: string };
    onCancel: () => void;
    onConfirm: (name: string, description: string | null) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    if (!props.visible) return null;
    const prefix = props.initialValues ? 'edit' : 'create';
    return react.createElement(
      native.View,
      { testID: `${prefix}-modal` },
      react.createElement(
        native.Text,
        {
          testID: `${prefix}-confirm`,
          onPress: () => props.onConfirm('New Map', 'desc'),
        },
        'confirm',
      ),
      react.createElement(
        native.Text,
        { testID: `${prefix}-cancel`, onPress: props.onCancel },
        'cancel',
      ),
    );
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useConfirmDelete', () => ({
  __esModule: true,
  useConfirmDelete: () => mockConfirmDelete,
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));
jest.mock('../../../src/services/storymanagement/LocationMapService', () => ({
  __esModule: true,
  createLocationMapService: () => ({
    getMapsForStory: mockGetMapsForStory,
    createMap: mockCreateMap,
    updateMap: mockUpdateMap,
    deleteMap: mockDeleteMap,
  }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: { selectedStory: unknown }) => unknown) =>
    selector({ selectedStory: mockStoryId ? { id: mockStoryId } : undefined }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: mockUserId }),
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockNotify }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      error: '#f00',
      text: '#111',
      textSecondary: '#666',
    },
  }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

import LocationMapListScreen from '../../../src/screens/location-maps/LocationMapListScreen';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';

const makeMap = (overrides = {}) => ({
  id: 'map-1',
  storyId: 'story-1',
  name: 'World',
  description: 'The world',
  content: { images: [], nodes: [] },
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  version: 1,
  isDeleted: false,
  deletedAt: null,
  ...overrides,
});

function headerActions() {
  const header = mockUseScreenHeader.mock.calls[mockUseScreenHeader.mock.calls.length - 1][0] as {
    actions: { onPress: () => void; visible: boolean }[];
  };
  return header.actions;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStoryId = 'story-1';
  mockCanEdit = true;
  mockUserId = 'user-1';
  mockGetMapsForStory.mockResolvedValue([]);
  mockCreateMap.mockResolvedValue(makeMap({ id: 'map-new' }));
  mockUpdateMap.mockResolvedValue(makeMap());
  mockDeleteMap.mockResolvedValue(undefined);
  mockConfirmDelete.mockImplementation(async ({ onConfirm }: { onConfirm: () => Promise<void> }) =>
    onConfirm(),
  );
});

afterEach(() => {
  cleanup();
});

it('loads maps and opens one on press', async () => {
  mockGetMapsForStory.mockResolvedValue([
    makeMap({ id: 'map-1', name: 'World' }),
    makeMap({ id: 'map-2', name: 'City', description: null }),
  ]);
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(mockGetMapsForStory).toHaveBeenCalledWith('story-1'));
  await waitFor(() => expect(view.getByText('World')).toBeTruthy());
  expect(view.getByText('City')).toBeTruthy();

  await fireEvent.press(view.getByText('City'));
  expect(mockNavigate).toHaveBeenCalledWith('LocationMap', { mapId: 'map-2' });
});

it('shows the empty state and filters by search', async () => {
  mockGetMapsForStory.mockResolvedValue([makeMap({ id: 'map-1', name: 'World' })]);
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('World')).toBeTruthy());
  await fireEvent.changeText(view.getByTestId('search-input'), 'zzz');
  expect(view.getByText('location_map_search_no_results')).toBeTruthy();
  expect(view.queryByText('World')).toBeNull();

  await fireEvent.changeText(view.getByTestId('search-input'), '');
  expect(view.getByText('World')).toBeTruthy();
});

it('shows the list empty state without maps', async () => {
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('location_map_list_empty')).toBeTruthy());
});

it('creates a map through the header action', async () => {
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('location_map_list_empty')).toBeTruthy());
  expect(headerActions()[0]!.visible).toBe(true);
  await act(async () => {
    headerActions()[0]!.onPress();
  });
  expect(view.getByTestId('create-modal')).toBeTruthy();

  await fireEvent.press(view.getByTestId('create-cancel'));
  expect(view.queryByTestId('create-modal')).toBeNull();

  await act(async () => {
    headerActions()[0]!.onPress();
  });
  await fireEvent.press(view.getByTestId('create-confirm'));
  await waitFor(() =>
    expect(mockCreateMap).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ storyId: 'story-1', name: 'New Map' }),
    ),
  );
  expect(mockNavigate).toHaveBeenCalledWith('LocationMap', { mapId: 'map-new' });
});

it('notifies when creation fails', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockCreateMap.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('location_map_list_empty')).toBeTruthy());
  await act(async () => {
    headerActions()[0]!.onPress();
  });
  await fireEvent.press(view.getByTestId('create-confirm'));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('location_map_save_failed', 'error'));
  consoleSpy.mockRestore();
});

it('edits map details through the row action', async () => {
  mockGetMapsForStory.mockResolvedValue([makeMap({ id: 'map-1', name: 'World' })]);
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('World')).toBeTruthy());
  const callsBefore = mockGetMapsForStory.mock.calls.length;
  await fireEvent.press(view.getByLabelText('edit'));
  expect(view.getByTestId('edit-modal')).toBeTruthy();

  await fireEvent.press(view.getByTestId('edit-confirm'));
  await waitFor(() =>
    expect(mockUpdateMap).toHaveBeenCalledWith(
      'user-1',
      'map-1',
      expect.objectContaining({ name: 'New Map' }),
    ),
  );
  await waitFor(() => expect(mockGetMapsForStory.mock.calls.length).toBeGreaterThan(callsBefore));
});

it('notifies when updating details fails', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockGetMapsForStory.mockResolvedValue([makeMap({ id: 'map-1', name: 'World' })]);
  mockUpdateMap.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('World')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('edit'));
  await fireEvent.press(view.getByTestId('edit-confirm'));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('location_map_save_failed', 'error'));
  consoleSpy.mockRestore();
});

it('duplicates a map after confirmation', async () => {
  mockGetMapsForStory.mockResolvedValue([makeMap({ id: 'map-1', name: 'World' })]);
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('World')).toBeTruthy());
  const callsBefore = mockGetMapsForStory.mock.calls.length;
  await fireEvent.press(view.getByLabelText('duplicate'));
  expect(mockAlert).toHaveBeenCalled();

  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  await act(async () => {
    await buttons.find((button) => button.text === 'confirm')!.onPress!();
  });
  expect(mockCreateMap).toHaveBeenCalledWith(
    'user-1',
    expect.objectContaining({ storyId: 'story-1', content: { images: [], nodes: [] } }),
  );
  await waitFor(() => expect(mockGetMapsForStory.mock.calls.length).toBeGreaterThan(callsBefore));
});

it('notifies when duplication fails', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockGetMapsForStory.mockResolvedValue([makeMap({ id: 'map-1', name: 'World' })]);
  mockCreateMap.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('World')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('duplicate'));
  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  await buttons.find((button) => button.text === 'confirm')!.onPress!();
  expect(mockNotify).toHaveBeenCalledWith('location_map_save_failed', 'error');
  consoleSpy.mockRestore();
});

it('deletes a map through the confirm hook', async () => {
  mockGetMapsForStory.mockResolvedValue([makeMap({ id: 'map-1', name: 'World' })]);
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('World')).toBeTruthy());
  const callsBefore = mockGetMapsForStory.mock.calls.length;
  await fireEvent.press(view.getByLabelText('delete'));
  expect(mockConfirmDelete).toHaveBeenCalledWith(
    expect.objectContaining({ titleKey: 'location_map_delete_title' }),
  );
  await waitFor(() => expect(mockDeleteMap).toHaveBeenCalledWith('user-1', 'map-1'));
  await waitFor(() => expect(mockGetMapsForStory.mock.calls.length).toBeGreaterThan(callsBefore));
});

it('shows the error state when loading fails', async () => {
  const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  mockGetMapsForStory.mockRejectedValue(new Error('boom'));
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByTestId('screen-error')).toBeTruthy());
  await fireEvent.press(view.getByTestId('screen-error'));
  expect(mockGoBack).toHaveBeenCalled();
  consoleSpy.mockRestore();
});

it('reloads only for the current story change event', async () => {
  await render(<LocationMapListScreen />);

  await waitFor(() => expect(mockGetMapsForStory).toHaveBeenCalled());
  const callsBefore = mockGetMapsForStory.mock.calls.length;
  entityEventEmitter.emit('location_map_changed', 'other-story');
  entityEventEmitter.emit('location_map_changed', 'story-1');
  await waitFor(() => expect(mockGetMapsForStory.mock.calls.length).toBeGreaterThan(callsBefore));
});

it('clears maps without a story', async () => {
  mockStoryId = undefined;
  const view = await render(<LocationMapListScreen />);

  await waitFor(() => expect(view.getByText('location_map_list_empty')).toBeTruthy());
  expect(mockGetMapsForStory).not.toHaveBeenCalled();
});
