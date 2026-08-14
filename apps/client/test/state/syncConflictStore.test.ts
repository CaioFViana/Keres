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
 * A tela de conflito se abre sozinha porque um conflito trava a sincronização daquela
 * entidade - deixá-lo num canto esconderia trabalho parado. Mas reabrir a cada ciclo de 30s
 * algo que a pessoa acabou de fechar seria hostil, então cada conflito só se impõe uma vez.
 */
describe('refresh', () => {
  it('opens the screen by itself when a conflict shows up', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);

    await store().refresh(db);

    expect(store().conflicts).toHaveLength(1);
    expect(store().isVisible).toBe(true);
  });

  it('stays closed when there is nothing pending', async () => {
    await store().refresh(db);

    expect(store().isVisible).toBe(false);
  });

  it('does not reopen a conflict the user just closed', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);
    store().close();

    await store().refresh(db);

    expect(store().isVisible).toBe(false);
  });

  it('opens again when a new conflict arrives after a close', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);
    store().close();

    mockService.getPendingConflicts.mockResolvedValue([conflict('c1'), conflict('c2')]);
    await store().refresh(db);

    expect(store().isVisible).toBe(true);
  });

  it('closes the screen once the last conflict is gone', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);

    mockService.getPendingConflicts.mockResolvedValue([]);
    await store().refresh(db);

    expect(store().isVisible).toBe(false);
    expect(store().conflicts).toEqual([]);
  });

  it('keeps the open index inside the list when conflicts disappear', async () => {
    mockService.getPendingConflicts.mockResolvedValue([
      conflict('c1'),
      conflict('c2'),
      conflict('c3'),
    ]);
    await store().refresh(db);
    store().setActiveIndex(2);

    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);

    expect(store().activeIndex).toBe(0);
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
  it('opens at the first conflict by default', () => {
    store().open();

    expect(store()).toMatchObject({ isVisible: true, activeIndex: 0 });
  });

  it('opens at the conflict the caller pointed at', () => {
    store().open(2);

    expect(store().activeIndex).toBe(2);
  });

  it('remembers every conflict that was on screen when it closed', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1'), conflict('c2')]);
    await store().refresh(db);

    store().close();

    expect(store().postponedConflictIds.sort()).toEqual(['c1', 'c2']);
  });

  it('does not duplicate ids across repeated closes', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);

    store().close();
    store().open();
    store().close();

    expect(store().postponedConflictIds).toEqual(['c1']);
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
  it('clears everything, including what was postponed', async () => {
    mockService.getPendingConflicts.mockResolvedValue([conflict('c1')]);
    await store().refresh(db);
    store().close();

    store().reset();

    expect(store()).toMatchObject({
      conflicts: [],
      activeIndex: 0,
      isVisible: false,
      isResolving: false,
      postponedConflictIds: [],
    });
  });
});
