import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockNavigate = jest.fn();
const mockNotify = jest.fn();
const mockListPacks = jest.fn();
const mockGetPackForUpload = jest.fn();
const mockDeletePack = jest.fn();
const mockGetAllServers = jest.fn();
const mockUpload = jest.fn();
const mockAlert = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;

jest.mock('@react-navigation/native', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useNavigation: () => ({ navigate: mockNavigate }),
    useFocusEffect: (callback: () => void | (() => void)) => react.useEffect(callback, [callback]),
  };
});
jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/services/storymanagement/PackService', () => ({
  __esModule: true,
  createPackService: () => ({
    listPacks: mockListPacks,
    getPackForUpload: mockGetPackForUpload,
    deletePack: mockDeletePack,
  }),
}));
jest.mock('../../../src/services/ServerService', () => ({
  __esModule: true,
  createServerService: () => ({ getAllServers: mockGetAllServers }),
}));
jest.mock('../../../src/services/PackApiService', () => ({
  __esModule: true,
  packApiService: { upload: (...args: unknown[]) => mockUpload(...args) },
}));
jest.mock('../../../src/components/features/packs/SharePackModal/SharePackModal', () => ({
  __esModule: true,
  default: (props: {
    visible: boolean;
    packName: string;
    onCancel: () => void;
    onConfirm: (serverId: string, visibility: string) => void;
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    if (!props.visible) return null;
    return react.createElement(
      native.View,
      { testID: 'share-modal' },
      react.createElement(native.Text, { testID: 'share-pack-name' }, props.packName),
      react.createElement(
        native.Text,
        { testID: 'share-cancel', onPress: props.onCancel },
        'cancel',
      ),
      react.createElement(
        native.Text,
        {
          testID: 'share-confirm',
          onPress: () => props.onConfirm('server-1', 'public'),
        },
        'confirm',
      ),
    );
  },
}));
jest.mock('../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: (selector: (state: { showNotification: unknown }) => unknown) =>
    selector({ showNotification: mockNotify }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#eee',
      error: '#f00',
      notification: '#f80',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#fafafa',
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

import PackListScreen from '../../../src/screens/packs/PackListScreen';

const makePack = (overrides = {}) => ({
  id: 'pack-1',
  name: 'Starter',
  description: 'A starter pack',
  language: 'en',
  authorName: 'Author',
  version: 2,
  sourceStoryId: 'story-1',
  counts: {
    customAttributes: 3,
    suggestions: 0,
    tags: 5,
    stats: 0,
    hasVocabulary: true,
    extras: {
      chapters: 0,
      scenes: 0,
      characters: 0,
      locations: 0,
      worldRules: 0,
      notes: 0,
      storyBoards: 0,
      storyLocationMaps: 0,
    },
  },
  ...overrides,
});

const makeServer = (overrides = {}) => ({
  id: 'server-1',
  url: 'https://example.test',
  name: 'Example',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockListPacks.mockResolvedValue([]);
  mockGetAllServers.mockResolvedValue([]);
  mockGetPackForUpload.mockResolvedValue({ id: 'pack-1', name: 'Starter' });
  mockDeletePack.mockResolvedValue(undefined);
  mockUpload.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

it('renders the header buttons and navigates', async () => {
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(view.getByText('packs_description')).toBeTruthy());
  expect(view.getByText('packs_empty')).toBeTruthy();

  await fireEvent.press(view.getByTestId('create-pack'));
  expect(mockNavigate).toHaveBeenCalledWith('PackForm', {});
  await fireEvent.press(view.getByTestId('browse-packs'));
  expect(mockNavigate).toHaveBeenCalledWith('PackBrowse');
  await fireEvent.press(view.getByTestId('shipped-packs'));
  expect(mockNavigate).toHaveBeenCalledWith('ShippedPacks');
});

it('renders pack cards with content chips', async () => {
  mockListPacks.mockResolvedValue([
    makePack(),
    makePack({
      id: 'pack-2',
      name: 'Empty',
      description: null,
      language: null,
      authorName: null,
      sourceStoryId: null,
      counts: {
        customAttributes: 0,
        suggestions: 0,
        tags: 0,
        stats: 0,
        hasVocabulary: false,
        extras: {
          chapters: 0,
          scenes: 0,
          characters: 0,
          locations: 0,
          worldRules: 0,
          notes: 0,
          storyBoards: 0,
          storyLocationMaps: 0,
        },
      },
    }),
    makePack({
      id: 'pack-3',
      name: 'Skeleton',
      description: null,
      language: null,
      authorName: null,
      sourceStoryId: null,
      counts: {
        customAttributes: 0,
        suggestions: 0,
        tags: 0,
        stats: 0,
        hasVocabulary: false,
        extras: {
          chapters: 2,
          scenes: 3,
          characters: 1,
          locations: 0,
          worldRules: 0,
          notes: 0,
          storyBoards: 0,
          storyLocationMaps: 0,
        },
      },
    }),
  ]);
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(view.getByText('Starter')).toBeTruthy());
  expect(view.getByText('Empty')).toBeTruthy();
  expect(view.getByText('packs_chip_attributes')).toBeTruthy();
  expect(view.getByText('packs_chip_empty')).toBeTruthy();
  expect(view.getByText('Skeleton')).toBeTruthy();
  expect(view.getByText('packs_chip_chapters')).toBeTruthy();
  expect(view.getByText('packs_chip_scenes')).toBeTruthy();
  expect(view.getByText('packs_chip_characters')).toBeTruthy();

  await fireEvent.press(view.getByLabelText('packs_reextract'));
  expect(mockNavigate).toHaveBeenCalledWith('PackForm', { packId: 'pack-1' });
});

it('notifies when listing packs fails', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockListPacks.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('packs_load_failed', 'error'));
  expect(view.getByText('packs_empty')).toBeTruthy();
  consoleSpy.mockRestore();
});

it('refuses to share without a server', async () => {
  mockListPacks.mockResolvedValue([makePack()]);
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(view.getByText('Starter')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('packs_share_title'));
  expect(mockNotify).toHaveBeenCalledWith('packs_share_no_server', 'error');
  expect(view.queryByTestId('share-modal')).toBeNull();
});

it('shares a pack through the modal', async () => {
  mockListPacks.mockResolvedValue([makePack()]);
  mockGetAllServers.mockResolvedValue([makeServer()]);
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(view.getByText('Starter')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('packs_share_title'));
  expect(view.getByTestId('share-modal')).toBeTruthy();
  expect(view.getByTestId('share-pack-name').props.children).toBe('Starter');

  await fireEvent.press(view.getByTestId('share-confirm'));
  await waitFor(() =>
    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'server-1' }),
      expect.objectContaining({ visibility: 'public' }),
    ),
  );
  expect(mockNotify).toHaveBeenCalledWith('packs_share_done', 'success');
});

it('cancels sharing and reports upload failures', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockListPacks.mockResolvedValue([makePack()]);
  mockGetAllServers.mockResolvedValue([makeServer()]);
  mockUpload.mockRejectedValueOnce(new Error('offline'));
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(view.getByText('Starter')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('packs_share_title'));
  await fireEvent.press(view.getByTestId('share-cancel'));
  expect(view.queryByTestId('share-modal')).toBeNull();
  expect(mockUpload).not.toHaveBeenCalled();

  await fireEvent.press(view.getByLabelText('packs_share_title'));
  await fireEvent.press(view.getByTestId('share-confirm'));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('packs_share_failed', 'error'));
  consoleSpy.mockRestore();
});

it('reports a missing uploadable pack', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockListPacks.mockResolvedValue([makePack()]);
  mockGetAllServers.mockResolvedValue([makeServer()]);
  mockGetPackForUpload.mockResolvedValueOnce(null);
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(view.getByText('Starter')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('packs_share_title'));
  await fireEvent.press(view.getByTestId('share-confirm'));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('packs_share_failed', 'error'));
  expect(mockUpload).not.toHaveBeenCalled();
  consoleSpy.mockRestore();
});

it('deletes a pack after confirmation and reloads', async () => {
  mockListPacks.mockResolvedValue([makePack()]);
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(view.getByText('Starter')).toBeTruthy());
  const callsBeforeDelete = mockListPacks.mock.calls.length;
  await fireEvent.press(view.getByLabelText('delete'));
  expect(mockAlert).toHaveBeenCalled();

  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  await buttons.find((button) => button.text === 'delete')!.onPress!();
  expect(mockDeletePack).toHaveBeenCalledWith('pack-1');
  await waitFor(() => expect(mockListPacks.mock.calls.length).toBeGreaterThan(callsBeforeDelete));
});

it('notifies when deletion fails', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockListPacks.mockResolvedValue([makePack()]);
  mockDeletePack.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(view.getByText('Starter')).toBeTruthy());
  await fireEvent.press(view.getByLabelText('delete'));
  const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
  await buttons.find((button) => button.text === 'delete')!.onPress!();
  expect(mockNotify).toHaveBeenCalledWith('packs_delete_failed', 'error');
  consoleSpy.mockRestore();
});

it('survives a server list failure', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetAllServers.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<PackListScreen />);

  await waitFor(() => expect(view.getByText('packs_description')).toBeTruthy());
  consoleSpy.mockRestore();
});
