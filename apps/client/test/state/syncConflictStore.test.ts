/**
 * @jest-environment node
 */
const mockService = {
  getPendingConflicts: jest.fn(async () => [] as { id: string }[]),
  resolveKeepLocal: jest.fn(async () => undefined),
  resolveKeepServer: jest.fn(async () => undefined),
  resolveKeepServerAndCloneBoard: jest.fn(async () => undefined),
  dismissConflict: jest.fn(async () => undefined),
};
jest.mock('../../src/services/SyncConflictService', () => ({
  createSyncConflictService: () => mockService,
}));

import { useSyncConflictStore } from '../../src/state/syncConflictStore';

const store = () => useSyncConflictStore.getState();
const db = {} as never;

const conflict = (id: string) => ({ id }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  store().reset();
  mockService.getPendingConflicts.mockResolvedValue([]);
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * The conflict screen no longer opens by itself - a conflict blocks that entity's
 * synchronization, but that does not justify interrupting what the user is doing; the entry
 * point (a banner on the Dashboard) is what decides when to open the review. `refresh` only reloads
 * the list.
 */
describe('refresh', () => {
  it('loads the pending conflicts', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);

    await store().refresh(db);

    expect(store().conflicts).toHaveLength(1);
  });

  it('ignores a stale refresh that resolves after a newer one', async () => {
    let resolveFirst!: (value: { id: string }[]) => void;
    mockService.getPendingConflicts
      .mockImplementationOnce(
        () => new Promise<{ id: string }[]>((resolve) => void (resolveFirst = resolve)),
      )
      .mockResolvedValueOnce([conflict('c2')]);

    const first = store().refresh(db);
    const second = store().refresh(db);
    await second;
    resolveFirst([conflict('c1')]);
    await first;

    expect(store().conflicts).toEqual([conflict('c2')]);
  });

  it('replaces the list wholesale, including clearing it out', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);

    mockService.getPendingConflicts.mockResolvedValue([]);
    await store().refresh(db);

    expect(store().conflicts).toEqual([]);
  });

  it('narrows to a single story when asked', async () => {
    await store().refresh(db, 'story-1');

    expect(mockService.getPendingConflicts).toHaveBeenCalledWith('story-1');
  });

  it('survives a failure to load, without wiping what is on screen', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);

    mockService.getPendingConflicts.mockRejectedValueOnce(new Error('banco fora'));
    await store().refresh(db);

    expect(store().conflicts).toHaveLength(1);
  });
});

describe('selecting a conflict for the field-diff drill-in', () => {
  it('selects and clears', () => {
    store().selectConflict('c1');
    expect(store().selectedConflictId).toBe('c1');

    store().clearSelection();
    expect(store().selectedConflictId).toBeNull();
  });
});

describe('resolving', () => {
  it('keeps the local values and reloads the list', async () => {
    await store().keepLocal(db, 'c1', { name: 'Meu' });

    expect(mockService.resolveKeepLocal).toHaveBeenCalledWith('c1', { name: 'Meu' });
    expect(mockService.getPendingConflicts).toHaveBeenCalled();
  });

  it('keeps the server values and reloads the list', async () => {
    await store().keepServer(db, 'c1');

    expect(mockService.resolveKeepServer).toHaveBeenCalledWith('c1');
    expect(mockService.getPendingConflicts).toHaveBeenCalled();
  });

  it('dismisses a conflict and reloads the list', async () => {
    await store().dismiss(db, 'c1');

    expect(mockService.dismissConflict).toHaveBeenCalledWith('c1');
    expect(mockService.getPendingConflicts).toHaveBeenCalled();
  });

  it('clears the selection when the resolved conflict was the one open in the drill-in', async () => {
    store().selectConflict('c1');

    await store().keepLocal(db, 'c1');

    expect(store().selectedConflictId).toBeNull();
  });

  it('leaves an unrelated selection untouched', async () => {
    store().selectConflict('c2');

    await store().keepLocal(db, 'c1');

    expect(store().selectedConflictId).toBe('c2');
  });

  it('lowers the resolving flag even when the write fails', async () => {
    mockService.resolveKeepLocal.mockRejectedValueOnce(new Error('sem permissão'));

    await store().keepLocal(db, 'c1');

    expect(store().isResolving).toBe(false);
  });

  it('still reloads the list after a failed resolution', async () => {
    mockService.resolveKeepServer.mockRejectedValueOnce(new Error('sem permissão'));

    await store().keepServer(db, 'c1');

    expect(mockService.getPendingConflicts).toHaveBeenCalled();
  });

  it('keeps the server board and clones the local drawing under a new name', async () => {
    store().selectConflict('c1');

    await store().keepServerAndCloneBoard(db, 'c1', 'user-1', 'Cópia local');

    expect(mockService.resolveKeepServerAndCloneBoard).toHaveBeenCalledWith(
      'c1',
      'user-1',
      'Cópia local',
    );
    expect(mockService.getPendingConflicts).toHaveBeenCalled();
    expect(store().selectedConflictId).toBeNull();
    expect(store().isResolving).toBe(false);
  });

  it('lowers the resolving flag and reloads even when the clone fails', async () => {
    mockService.resolveKeepServerAndCloneBoard.mockRejectedValueOnce(new Error('sem espaço'));

    await store().keepServerAndCloneBoard(db, 'c1', 'user-1', 'Cópia local');

    expect(console.log).toHaveBeenCalledWith(
      'useSyncConflictStore: failed to clone the local board.',
      expect.any(Error),
    );
    expect(store().isResolving).toBe(false);
    expect(mockService.getPendingConflicts).toHaveBeenCalled();
  });

  it('still reloads the list after a failed dismissal', async () => {
    mockService.dismissConflict.mockRejectedValueOnce(new Error('sem permissão'));

    await store().dismiss(db, 'c1');

    expect(console.log).toHaveBeenCalledWith(
      'useSyncConflictStore: failed to dismiss conflict.',
      expect.any(Error),
    );
    expect(mockService.getPendingConflicts).toHaveBeenCalled();
  });
});

describe('preserving the loaded scope', () => {
  beforeEach(async () => {
    await store().refresh(db, 'story-1');
    mockService.getPendingConflicts.mockClear();
  });

  it('reloads the same story after keeping local', async () => {
    await store().keepLocal(db, 'c1');

    expect(mockService.getPendingConflicts).toHaveBeenCalledWith('story-1');
  });

  it('reloads the same story after keeping server', async () => {
    await store().keepServer(db, 'c1');

    expect(mockService.getPendingConflicts).toHaveBeenCalledWith('story-1');
  });

  it('reloads the same story after cloning the board', async () => {
    await store().keepServerAndCloneBoard(db, 'c1', 'user-1', 'Cópia local');

    expect(mockService.getPendingConflicts).toHaveBeenCalledWith('story-1');
  });

  it('reloads the same story after dismissing', async () => {
    await store().dismiss(db, 'c1');

    expect(mockService.getPendingConflicts).toHaveBeenCalledWith('story-1');
  });
});

describe('reset', () => {
  it('clears everything', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db, 'story-1');
    store().selectConflict('c1');

    store().reset();

    expect(store()).toMatchObject({
      conflicts: [],
      selectedConflictId: null,
      isResolving: false,
      lastScope: undefined,
    });
  });

  it('drops an in-flight refresh that resolves after the reset', async () => {
    let resolveLoad!: (value: { id: string }[]) => void;
    mockService.getPendingConflicts.mockImplementationOnce(
      () => new Promise<{ id: string }[]>((resolve) => void (resolveLoad = resolve)),
    );

    const load = store().refresh(db);
    store().reset();
    resolveLoad([conflict('c1')]);
    await load;

    expect(store().conflicts).toEqual([]);
  });
});
