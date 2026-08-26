/**
 * @jest-environment node
 */
const mockService = {
  getPendingConflicts: jest.fn(async () => [] as { id: string }[]),
  resolveKeepLocal: jest.fn(async () => undefined),
  resolveKeepServer: jest.fn(async () => undefined),
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
  it('loads the pending conflicts without opening the screen', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);

    await store().refresh(db);

    expect(store().conflicts).toHaveLength(1);
    expect(store().isVisible).toBe(false);
  });

  it('never opens the screen on its own, even across repeated refreshes', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);
    await store().refresh(db);

    mockService.getPendingConflicts.mockResolvedValue([conflict('c1'), conflict('c2')]);
    await store().refresh(db);

    expect(store().isVisible).toBe(false);
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

describe('open and close', () => {
  it('opens and closes as a plain toggle', () => {
    store().open();
    expect(store().isVisible).toBe(true);

    store().close();
    expect(store().isVisible).toBe(false);
  });

  it('clears the selected conflict when closing', () => {
    store().selectConflict('c1');
    store().close();

    expect(store().selectedConflictId).toBeNull();
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
});

describe('reset', () => {
  it('clears everything', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);
    store().selectConflict('c1');
    store().open();

    store().reset();

    expect(store()).toMatchObject({
      conflicts: [],
      selectedConflictId: null,
      isVisible: false,
      isResolving: false,
    });
  });
});
