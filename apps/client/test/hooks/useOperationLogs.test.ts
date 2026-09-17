const mockDb = { select: jest.fn() };
const mockT = (key: string) => key;
const mockSettings = { userId: 'user-1' };
const mockService = {
  getPaginatedOperationLogs: jest.fn(),
  getRecentOperationLogs: jest.fn(),
  getFavoriteBehavior: jest.fn(),
};

jest.mock('../../src/db', () => ({
  __esModule: true,
  useDrizzle: jest.fn(() => mockDb),
  worldRules: { id: 'id', section: 'section', storyId: 'storyId' },
}));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(() => ({ t: mockT })),
}));
jest.mock('../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: jest.fn(() => mockSettings),
}));
jest.mock('../../src/services/OperationLogService', () => ({
  __esModule: true,
  createOperationLogService: jest.fn(() => mockService),
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return { useEntityInitialLoad: (load: () => void) => React.useEffect(load, [load]) };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useOperationLogs } from '../../src/hooks/useOperationLogs';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

beforeEach(() => {
  jest.clearAllMocks();
  mockService.getRecentOperationLogs.mockResolvedValue([
    { id: 'recent-1', entityType: 'Character', entityId: 'char-1' },
  ]);
  mockService.getPaginatedOperationLogs.mockImplementation(
    async (_story: string, page: number) => ({
      logs: [{ id: `page-${page}`, entityType: 'Character', entityId: 'char-1' }],
      total: 3,
    }),
  );
  mockService.getFavoriteBehavior.mockResolvedValue('individual_public');
});

describe('useOperationLogs', () => {
  it('loads recent logs, favorite behavior, and refreshes for matching events', async () => {
    const view = await renderHook(() => useOperationLogs({ storyId: 'story-1', limit: 5 }));
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current).toMatchObject({
      logs: [{ id: 'recent-1' }],
      favoriteBehavior: 'individual_public',
      error: null,
    });
    await act(async () => entityEventEmitter.emit('operation_log_updated', 'story-1'));
    await waitFor(() => expect(mockService.getRecentOperationLogs).toHaveBeenCalledTimes(2));
  });

  it('appends distinct pages and exposes failures as translated errors', async () => {
    const view = await renderHook(() =>
      useOperationLogs({ storyId: 'story-1', paginated: true, pageSize: 1 }),
    );
    await waitFor(() =>
      expect(view.result.current.logs).toEqual([expect.objectContaining({ id: 'page-1' })]),
    );
    await act(async () => view.result.current.loadMore());
    await waitFor(() =>
      expect(view.result.current.logs).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: 'page-2' })]),
      ),
    );

    mockService.getPaginatedOperationLogs.mockRejectedValueOnce(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => entityEventEmitter.emit('operation_log_updated', 'story-1'));
    await waitFor(() => expect(view.result.current.error).toBe('failed_to_load_operation_logs'));
  });

  it('resolves world piece sections for world-rule logs and refetches on demand', async () => {
    const { OperationLogEntityType } = jest.requireActual(
      '@keres/shared',
    ) as typeof import('@keres/shared');
    const all = jest.fn().mockResolvedValue([{ id: 'wp-1', section: 'Lore' }]);
    const where = jest.fn(() => ({ all }));
    const from = jest.fn(() => ({ where }));
    mockDb.select.mockReturnValue({ from });
    mockService.getRecentOperationLogs.mockResolvedValue([
      { id: 'log-1', entityType: OperationLogEntityType.WorldRule, entityId: 'wp-1' },
    ]);
    const view = await renderHook(() =>
      useOperationLogs({ storyId: 'story-1', limit: 5, shouldRefetch: true }),
    );
    await waitFor(() => expect(view.result.current.worldPieceSections).toEqual({ 'wp-1': 'Lore' }));
    expect(mockService.getRecentOperationLogs).toHaveBeenCalled();
    view.unmount();
  });

  it('clears world piece sections when the lookup fails and ignores other stories', async () => {
    const { OperationLogEntityType } = jest.requireActual(
      '@keres/shared',
    ) as typeof import('@keres/shared');
    const all = jest.fn().mockRejectedValue(new Error('offline'));
    mockDb.select.mockReturnValue({ from: () => ({ where: () => ({ all }) }) });
    mockService.getRecentOperationLogs.mockResolvedValue([
      { id: 'log-1', entityType: OperationLogEntityType.WorldRule, entityId: 'wp-1' },
    ]);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const view = await renderHook(() => useOperationLogs({ storyId: 'story-1', limit: 5 }));
    await waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith(
        'Could not resolve World Piece appearances for operation logs.',
        expect.any(Error),
      ),
    );
    expect(view.result.current.worldPieceSections).toEqual({});

    const calls = mockService.getRecentOperationLogs.mock.calls.length;
    await act(async () => entityEventEmitter.emit('operation_log_updated', 'other-story'));
    expect(mockService.getRecentOperationLogs).toHaveBeenCalledTimes(calls);
    await act(async () => view.result.current.loadMore());
    expect(mockService.getRecentOperationLogs).toHaveBeenCalledTimes(calls);
  });

  it('fetches nothing without a database and scopes reads to guests without a user', async () => {
    (useDrizzle as jest.Mock).mockReturnValue(null);
    const nodb = await renderHook(() => useOperationLogs({ storyId: 'story-1', limit: 5 }));
    await act(async () => {});
    expect(nodb.result.current.logs).toEqual([]);
    expect(mockService.getRecentOperationLogs).not.toHaveBeenCalled();
    (useDrizzle as jest.Mock).mockReturnValue(mockDb);

    mockSettings.userId = null as never;
    await renderHook(() => useOperationLogs({ storyId: 'story-1', paginated: true, pageSize: 1 }));
    await waitFor(() => expect(mockService.getPaginatedOperationLogs).toHaveBeenCalled());
    expect(mockService.getPaginatedOperationLogs).toHaveBeenCalledWith('story-1', 1, 1, undefined);
    mockSettings.userId = 'user-1';
  });
});
