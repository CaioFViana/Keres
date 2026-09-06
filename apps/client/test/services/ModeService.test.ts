const mockServerService = {};
const mockWritable = jest.fn();
const mockPrepare = jest.fn();
const mockOperation = jest.fn();
const mockEmit = jest.fn();
jest.mock('../../src/services/ServerService', () => ({
  __esModule: true,
  createServerService: jest.fn(() => mockServerService),
}));
jest.mock('../../src/utils/syncUtils', () => ({
  __esModule: true,
  assertStoryIsWritable: (...args: unknown[]) => mockWritable(...args),
  getUserIdForOperation: jest.fn().mockResolvedValue('actor'),
  recordLocalOperation: (...args: unknown[]) => mockOperation(...args),
}));
jest.mock('../../src/utils/entityUtils', () => ({
  __esModule: true,
  prepareNewEntityData: (...args: unknown[]) => mockPrepare(...args),
}));
jest.mock('../../src/utils/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: { emit: (...args: unknown[]) => mockEmit(...args) },
}));

import { createModeService } from '../../src/services/storymanagement/ModeService';

function queryChain(rows: unknown) {
  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    all: jest.fn().mockResolvedValue(rows),
  };
}

describe('ModeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWritable.mockResolvedValue(undefined);
    mockPrepare.mockImplementation((data) => ({ ...data, id: 'new-mode' }));
  });
  it('reads story and character mode lists in their configured order', async () => {
    const first = queryChain([{ id: 'mode-1' }]);
    const second = queryChain([{ id: 'mode-2' }]);
    const db = {
      select: jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second),
      query: { modes: { findFirst: jest.fn().mockResolvedValue({ id: 'mode-3' }) } },
    } as never;
    const service = createModeService(db);
    await expect(service.getModesByStoryId('story-1')).resolves.toEqual([{ id: 'mode-1' }]);
    await expect(service.getModesByCharacterId('character-1')).resolves.toEqual([{ id: 'mode-2' }]);
    await expect(service.getById('mode-3')).resolves.toEqual({ id: 'mode-3' });
  });

  it('rejects update of a mode that no longer exists', async () => {
    const db = { query: { modes: { findFirst: jest.fn().mockResolvedValue(undefined) } } } as never;
    await expect(
      createModeService(db).updateMode('user', 'missing', { name: 'New' }),
    ).rejects.toThrow('not found');
  });

  it('creates and updates modes with a local operation and change event', async () => {
    const insert = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ id: 'new-mode' }),
    };
    const update = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ storyId: 'story', version: 2 }]),
    };
    const db = {
      insert: jest.fn(() => insert),
      update: jest.fn(() => update),
      query: {
        modes: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'mode-1',
            storyId: 'story',
            characterId: 'character',
            isDeleted: false,
          }),
        },
      },
    } as never;
    const service = createModeService(db);
    await service.createMode('user', {
      storyId: 'story',
      characterId: 'character',
      name: 'Battle',
    } as never);
    await service.updateMode('user', 'mode-1', { name: 'Stealth' });
    expect(mockOperation).toHaveBeenCalledWith(
      db,
      'story',
      'actor',
      'create',
      'Mode',
      'new-mode',
      expect.any(Object),
    );
    expect(mockOperation).toHaveBeenCalledWith(
      db,
      'story',
      'actor',
      'update',
      'Mode',
      'mode-1',
      expect.objectContaining({ name: 'Stealth' }),
    );
    expect(mockEmit).toHaveBeenCalledWith('mode_changed', 'story', 'character');
  });

  it('silently ignores deletion of absent or deleted modes', async () => {
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'mode-1', isDeleted: true });
    const service = createModeService({ query: { modes: { findFirst } } } as never);
    await service.deleteMode('user', 'missing');
    await service.deleteMode('user', 'already-deleted');
    expect(mockWritable).not.toHaveBeenCalled();
  });
});
