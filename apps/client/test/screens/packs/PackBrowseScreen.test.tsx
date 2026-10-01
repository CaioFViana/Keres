import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNotify = jest.fn();
const mockGetAllServers = jest.fn();
const mockListPacks = jest.fn();
const mockImportRemotePack = jest.fn();
const mockRemoteList = jest.fn();
const mockDownload = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;

jest.mock('@expo/vector-icons', () => ({ __esModule: true, Ionicons: () => null }));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));
jest.mock('@/src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => ({
  __esModule: true,
  SingleSelectPill: (props: {
    value: string | null;
    onValueChange: (value: string | null) => void;
    options: { label: string; value: string }[];
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      { testID: 'server-pill' },
      react.createElement(native.Text, { testID: 'server-value' }, props.value ?? 'none'),
      ...props.options.map((option) =>
        react.createElement(
          native.Text,
          {
            key: option.value,
            testID: `server-${option.value}`,
            onPress: () => props.onValueChange(option.value),
          },
          option.label,
        ),
      ),
    );
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/services/PackApiService', () => ({
  __esModule: true,
  packApiService: {
    list: (...args: unknown[]) => mockRemoteList(...args),
    download: (...args: unknown[]) => mockDownload(...args),
  },
}));
jest.mock('../../../src/services/ServerService', () => ({
  __esModule: true,
  createServerService: () => ({ getAllServers: mockGetAllServers }),
}));
jest.mock('../../../src/services/storymanagement/PackService', () => ({
  __esModule: true,
  createPackService: () => ({
    listPacks: mockListPacks,
    importRemotePack: mockImportRemotePack,
  }),
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
      error: '#f00',
      onPrimary: '#fff',
      primary: '#00f',
      surface: '#fafafa',
      text: '#111',
      textSecondary: '#666',
    },
  }),
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: () => ({ t: mockT }),
}));

import PackBrowseScreen from '../../../src/screens/packs/PackBrowseScreen';

const makeServer = (overrides = {}) => ({
  id: 'server-1',
  url: 'https://one.test',
  name: 'One',
  ...overrides,
});

const makeRemotePack = (overrides = {}) => ({
  id: 'remote-1',
  name: 'Remote Pack',
  description: 'From the server',
  language: 'en',
  authorName: 'Author',
  version: 3,
  visibility: 'public',
  content: { customAttributes: [] },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllServers.mockResolvedValue([]);
  mockListPacks.mockResolvedValue([]);
  mockImportRemotePack.mockResolvedValue(undefined);
  mockRemoteList.mockResolvedValue([]);
  mockDownload.mockResolvedValue(makeRemotePack());
});

afterEach(() => {
  cleanup();
});

it('asks for a server when none is chosen', async () => {
  const view = await render(<PackBrowseScreen />);

  await waitFor(() => expect(mockGetAllServers).toHaveBeenCalled());
  expect(view.getByText('packs_browse_description')).toBeTruthy();
  expect(view.getByText('packs_browse_choose_server')).toBeTruthy();
  expect(view.getByTestId('server-value').props.children).toBe('none');
  expect(mockRemoteList).not.toHaveBeenCalled();
});

it('auto-selects a single server and lists its packs', async () => {
  mockGetAllServers.mockResolvedValue([makeServer()]);
  mockRemoteList.mockResolvedValue([makeRemotePack()]);
  const view = await render(<PackBrowseScreen />);

  await waitFor(() => expect(view.getByTestId('server-value').props.children).toBe('server-1'));
  await waitFor(() => expect(view.getByText('Remote Pack')).toBeTruthy());
  expect(view.getByText('From the server')).toBeTruthy();
  expect(view.getByText('packs_download')).toBeTruthy();
});

it('switches servers through the pill', async () => {
  mockGetAllServers.mockResolvedValue([
    makeServer(),
    makeServer({ id: 'server-2', name: null, url: 'https://two.test' }),
  ]);
  mockRemoteList.mockResolvedValue([]);
  const view = await render(<PackBrowseScreen />);

  await waitFor(() => expect(view.getByTestId('server-server-2')).toBeTruthy());
  expect(view.getByText('https://two.test')).toBeTruthy();
  await fireEvent.press(view.getByTestId('server-server-2'));
  await waitFor(() => expect(mockRemoteList).toHaveBeenCalled());
  expect(view.getByText('packs_browse_empty')).toBeTruthy();
});

it('reports remote listing failures', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetAllServers.mockResolvedValue([makeServer()]);
  mockRemoteList.mockRejectedValueOnce(new Error('offline'));
  const view = await render(<PackBrowseScreen />);

  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('packs_browse_failed', 'error'));
  expect(view.getByText('packs_browse_empty')).toBeTruthy();
  consoleSpy.mockRestore();
});

it('downloads a pack and marks it local', async () => {
  mockGetAllServers.mockResolvedValue([makeServer()]);
  mockRemoteList.mockResolvedValue([makeRemotePack()]);
  mockDownload.mockResolvedValueOnce(makeRemotePack({ id: 'remote-1', name: 'Remote Pack' }));
  const view = await render(<PackBrowseScreen />);

  await waitFor(() => expect(view.getByText('Remote Pack')).toBeTruthy());
  await fireEvent.press(view.getByTestId('download-remote-1'));
  await waitFor(() =>
    expect(mockImportRemotePack).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'remote-1', name: 'Remote Pack' }),
    ),
  );
  expect(mockNotify).toHaveBeenCalledWith('packs_download_done', 'success');
  await waitFor(() => expect(view.getByText('packs_download_again')).toBeTruthy());
});

it('flags packs that are already local', async () => {
  mockGetAllServers.mockResolvedValue([makeServer()]);
  mockListPacks.mockResolvedValue([{ id: 'remote-1' }]);
  mockRemoteList.mockResolvedValue([makeRemotePack({ description: null })]);
  const view = await render(<PackBrowseScreen />);

  await waitFor(() => expect(view.getByText('packs_download_again')).toBeTruthy());
});

it('reports download failures', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetAllServers.mockResolvedValue([makeServer()]);
  mockRemoteList.mockResolvedValue([makeRemotePack()]);
  mockDownload.mockRejectedValueOnce(new Error('bad payload'));
  const view = await render(<PackBrowseScreen />);

  await waitFor(() => expect(view.getByText('Remote Pack')).toBeTruthy());
  await fireEvent.press(view.getByTestId('download-remote-1'));
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith('packs_download_failed', 'error'));
  consoleSpy.mockRestore();
});

it('survives a server load failure', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetAllServers.mockRejectedValueOnce(new Error('boom'));
  const view = await render(<PackBrowseScreen />);

  expect(view.getByText('packs_browse_description')).toBeTruthy();
  await waitFor(() => expect(consoleSpy).toHaveBeenCalled());
  consoleSpy.mockRestore();
});
