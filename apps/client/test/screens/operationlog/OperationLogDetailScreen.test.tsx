import { act, cleanup, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const mockGetOperationLogById = jest.fn();
const mockGetEntityIdentifier = jest.fn();
const mockDb = {};
const mockT = (key: string) => key;
let mockUserId: string | null = 'user-1';
let mockEntityName: string | null = 'Aria';
let mockEntityLoading = false;
let mockUserDisplayName = 'Writer';

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useRoute: () => ({ params: { logId: 'log-1' } }),
}));
jest.mock('@expo/vector-icons', () => ({
  __esModule: true,
  Ionicons: ({ name }: { name: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: `icon-${name}` }, name);
  },
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));
jest.mock('@/src/components/layout/ScreenSection/ScreenSection', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: `section-${title}` }, title);
  },
}));
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useEntityName', () => ({
  __esModule: true,
  useEntityName: () => ({ entityName: mockEntityName, loading: mockEntityLoading }),
}));
jest.mock('../../../src/hooks/useUserDisplayName', () => ({
  __esModule: true,
  useUserDisplayName: () => mockUserDisplayName,
}));
jest.mock('../../../src/services/EntityService', () => ({
  __esModule: true,
  EntityService: { getEntityIdentifier: (...args: unknown[]) => mockGetEntityIdentifier(...args) },
}));
jest.mock('../../../src/services/OperationLogService', () => ({
  __esModule: true,
  createOperationLogService: () => ({ getOperationLogById: mockGetOperationLogById }),
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
      error: '#f00',
      primary: '#00f',
      shadow: '#000',
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

import OperationLogDetailScreen from '../../../src/screens/operationlog/OperationLogDetailScreen';
import { entityEventEmitter } from '../../../src/utils/EventEmitter';

const makeLog = (overrides = {}) => ({
  id: 'log-1',
  storyId: 'story-1',
  userId: 'user-1',
  entityType: 'Character',
  entityId: 'char-1',
  operationType: 'update',
  payload: JSON.stringify({ name: 'Aria' }),
  isSynced: true,
  serverOperationVersion: 7,
  createdAt: new Date('2026-02-03T10:00:00.000Z'),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'user-1';
  mockEntityName = 'Aria';
  mockEntityLoading = false;
  mockUserDisplayName = 'Writer';
  mockGetOperationLogById.mockResolvedValue(makeLog());
  mockGetEntityIdentifier.mockImplementation(
    async (_db: unknown, _type: string, entityId: string) => `resolved-${entityId}`,
  );
});

afterEach(() => {
  cleanup();
});

it('shows the loading state while fetching', async () => {
  mockGetOperationLogById.mockImplementation(() => new Promise(() => {}));
  const view = await render(<OperationLogDetailScreen />);

  expect(view.getByText(/loading_details/)).toBeTruthy();
});

it('waits for the entity name too', async () => {
  mockEntityLoading = true;
  const view = await render(<OperationLogDetailScreen />);

  expect(view.getByText(/loading_details/)).toBeTruthy();
});

it('renders the header with user, date and sync state', async () => {
  mockGetOperationLogById.mockResolvedValueOnce(
    makeLog({ payload: JSON.stringify({ title: 'Boss' }) }),
  );
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByTestId('icon-create-outline')).toBeTruthy());
  expect(view.getByText(/Aria/)).toBeTruthy();
  expect(view.getByText('Character')).toBeTruthy();
  expect(view.getByText('Writer')).toBeTruthy();
  expect(view.getByText(/2026/)).toBeTruthy();
  expect(view.getByText(/synced/)).toBeTruthy();
  expect(mockGetOperationLogById).toHaveBeenCalledWith('log-1', 'user-1');
});

it('maps every operation type to an icon', async () => {
  for (const [operationType, icon] of [
    ['create', 'add-circle-outline'],
    ['update', 'create-outline'],
    ['delete', 'trash-outline'],
    ['reorder', 'repeat-outline'],
    ['mystery', 'help-circle-outline'],
  ] as const) {
    mockGetOperationLogById.mockResolvedValueOnce(
      makeLog({
        operationType,
        payload:
          operationType === 'reorder'
            ? JSON.stringify({ reorderItems: [{ id: 'ch-1', newIndex: 0 }] })
            : JSON.stringify({ name: 'Aria' }),
      }),
    );
    const view = await render(<OperationLogDetailScreen />);
    await waitFor(() => expect(view.getByTestId(`icon-${icon}`)).toBeTruthy());
  }
});

it('shows pending state and the unknown entity fallback', async () => {
  mockEntityName = null;
  mockGetOperationLogById.mockResolvedValueOnce(
    makeLog({ isSynced: false, serverOperationVersion: 0 }),
  );
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByText(/unknown_entity/)).toBeTruthy());
  expect(view.getByText(/pending/)).toBeTruthy();
});

it('renders payload fields with metadata labels and fallbacks', async () => {
  mockEntityName = 'Hero';
  mockGetOperationLogById.mockResolvedValueOnce(
    makeLog({
      payload: JSON.stringify({
        name: 'Aria',
        someCustomField: 'raw',
        nickname: null,
        isFavorite: true,
        archived: false,
      }),
    }),
  );
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByText('field_name')).toBeTruthy());
  expect(view.getByText('Aria')).toBeTruthy();
  expect(view.getByText('Some Custom Field')).toBeTruthy();
  expect(view.getByText('conflict_empty_value')).toBeTruthy();
  expect(view.getByTestId('icon-checkmark-circle')).toBeTruthy();
  expect(view.getByTestId('icon-close-circle')).toBeTruthy();
});

it('resolves reference fields through the entity service', async () => {
  mockGetOperationLogById.mockResolvedValueOnce(
    makeLog({ payload: JSON.stringify({ choiceId: 'choice-9' }) }),
  );
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByText('resolved-choice-9')).toBeTruthy());
  expect(mockGetEntityIdentifier).toHaveBeenCalledWith(
    mockDb,
    'choice',
    'choice-9',
    'story-1',
    mockT,
  );
});

it('formats dates and objects inside the payload', async () => {
  mockGetOperationLogById.mockResolvedValueOnce(
    makeLog({
      payload: JSON.stringify({
        deletedAt: '2026-03-04T12:30:00.000Z',
        extra: { nested: true },
      }),
    }),
  );
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getAllByText(/2026/).length).toBe(2));
  expect(view.getByText(/nested/)).toBeTruthy();
});

it('displays suggestion values through the catalog formatter', async () => {
  mockGetOperationLogById.mockResolvedValueOnce(
    makeLog({
      entityType: 'Suggestion',
      payload: JSON.stringify({ value: '{"type":"list_element","name":"Fire"}' }),
    }),
  );
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByText('Fire')).toBeTruthy());
});

it('renders reorder payloads with resolved chapter names', async () => {
  mockGetOperationLogById.mockResolvedValueOnce(
    makeLog({
      entityType: 'Story',
      operationType: 'reorder',
      payload: JSON.stringify({ reorderItems: [{ id: 'ch-1', newIndex: 0 }] }),
    }),
  );
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByText('resolved-ch-1')).toBeTruthy());
  expect(mockGetEntityIdentifier).toHaveBeenCalledWith(mockDb, 'chapter', 'ch-1', 'story-1', mockT);
});

it('renders reorder payloads on chapters with resolved scene names', async () => {
  mockGetOperationLogById.mockResolvedValueOnce(
    makeLog({
      entityType: 'Chapter',
      operationType: 'reorder',
      payload: JSON.stringify({ reorderItems: [{ id: 'sc-2', newIndex: 1 }] }),
    }),
  );
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByText('resolved-sc-2')).toBeTruthy());
  expect(mockGetEntityIdentifier).toHaveBeenCalledWith(mockDb, 'scene', 'sc-2', 'story-1', mockT);
});

it('falls back to the raw id when resolution fails', async () => {
  mockGetEntityIdentifier.mockRejectedValueOnce(new Error('gone'));
  mockGetOperationLogById.mockResolvedValueOnce(
    makeLog({ payload: JSON.stringify({ choiceId: 'choice-9' }) }),
  );
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByText('choice-9')).toBeTruthy());
});

it('shows the no-changes state for empty payloads', async () => {
  mockGetOperationLogById.mockResolvedValueOnce(makeLog({ payload: JSON.stringify({}) }));
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByText('operation_log_no_changes')).toBeTruthy());
});

it('shows error states for missing and failed loads', async () => {
  mockGetOperationLogById.mockResolvedValueOnce(null);
  const missing = await render(<OperationLogDetailScreen />);
  await waitFor(() => expect(missing.getByText('operation_log_not_found')).toBeTruthy());

  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockGetOperationLogById.mockRejectedValueOnce(new Error('boom'));
  const failed = await render(<OperationLogDetailScreen />);
  await waitFor(() =>
    expect(failed.getByText('failed_to_load_operation_log_details')).toBeTruthy(),
  );
  consoleSpy.mockRestore();
});

it('refetches when the current story reports an update', async () => {
  const view = await render(<OperationLogDetailScreen />);

  await waitFor(() => expect(view.getByText('Writer')).toBeTruthy());
  const callsBefore = mockGetOperationLogById.mock.calls.length;

  await act(async () => {
    entityEventEmitter.emit('operation_log_updated', 'other-story');
  });
  expect(mockGetOperationLogById.mock.calls.length).toBe(callsBefore);

  await act(async () => {
    entityEventEmitter.emit('operation_log_updated', 'story-1');
  });
  await waitFor(() =>
    expect(mockGetOperationLogById.mock.calls.length).toBeGreaterThan(callsBefore),
  );
});
