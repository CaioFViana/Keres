const mockDb = {};
const mockStore = {
  isResolving: true,
  keepLocal: jest.fn(),
  keepServer: jest.fn(),
  keepServerAndCloneBoard: jest.fn(),
};

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/state/syncConflictStore', () => ({
  __esModule: true,
  useSyncConflictStore: jest.fn((selector) => selector(mockStore)),
}));

import { act, renderHook } from '@testing-library/react-native';
import { useSyncConflictActions } from '../../src/hooks/useSyncConflictActions';

describe('useSyncConflictActions', () => {
  it('binds conflict-store actions to the current database', async () => {
    const view = await renderHook(() => useSyncConflictActions());
    const values = { title: 'local title' };
    await act(async () => {
      view.result.current.keepLocal('conflict-1', values);
      view.result.current.keepServer('conflict-2');
      view.result.current.keepServerAndCloneBoard('conflict-3', 'user-1', 'Copy');
    });
    expect(view.result.current.isResolving).toBe(true);
    expect(mockStore.keepLocal).toHaveBeenCalledWith(mockDb, 'conflict-1', values);
    expect(mockStore.keepServer).toHaveBeenCalledWith(mockDb, 'conflict-2');
    expect(mockStore.keepServerAndCloneBoard).toHaveBeenCalledWith(
      mockDb,
      'conflict-3',
      'user-1',
      'Copy',
    );
  });
});
