const mockServerService = {};
const mockPrepare = jest.fn();
const mockOperation = jest.fn();
const mockEmit = jest.fn();
jest.mock('../../src/services/ServerService', () => ({
  __esModule: true,
  createServerService: jest.fn(() => mockServerService),
}));
jest.mock('../../src/utils/syncUtils', () => ({
  __esModule: true,
  assertStoryIsWritable: jest.fn().mockResolvedValue(undefined),
  getUserIdForOperation: jest.fn(),
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

import { createStatStrengthService } from '../../src/services/storymanagement/StatStrengthService';

function queryChain(rows: unknown) {
  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    all: jest.fn().mockResolvedValue(rows),
  };
}

describe('StatStrengthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepare.mockImplementation((data) => ({ ...data, id: 'tier-new' }));
  });
  it('reads complete and stat-specific live ladders', async () => {
    const first = queryChain([{ id: 'tier-1', minValue: 0 }]);
    const second = queryChain([{ id: 'tier-2', minValue: 10 }]);
    const db = {
      select: jest.fn().mockReturnValueOnce(first).mockReturnValueOnce(second),
    } as never;
    const service = createStatStrengthService(db);
    await expect(service.getStrengthsByStoryId('story-1')).resolves.toEqual([
      { id: 'tier-1', minValue: 0 },
    ]);
    await expect(service.getLadder('story-1', 'stat-1')).resolves.toEqual([
      { id: 'tier-2', minValue: 10 },
    ]);
  });

  it('rejects invalid replacement ladders before writing', async () => {
    const db = {} as never;
    const service = createStatStrengthService(db);
    await expect(
      service.replaceLadder('user', 'story', null, [
        { label: 'A', minValue: 0 },
        { label: 'B', minValue: 0 },
      ]),
    ).rejects.toThrow('two tiers');
    await expect(
      service.replaceLadder('user', 'story', null, [{ label: 'A', minValue: -1 }]),
    ).rejects.toThrow('negative');
    await expect(
      service.replaceLadder('user', 'story', null, [{ label: '   ', minValue: 1 }]),
    ).rejects.toThrow('needs a label');
  });

  it('rejects duplicate floors when creating an individual tier', async () => {
    const db = { select: jest.fn(() => queryChain([{ id: 'existing', minValue: 5 }])) } as never;
    await expect(
      createStatStrengthService(db).createStrength('user', {
        storyId: 'story',
        statId: null,
        minValue: 5,
        label: 'A',
      } as never),
    ).rejects.toThrow('already has');
  });

  it('creates a unique tier and records its synchronization operation', async () => {
    const read = queryChain([]);
    const insert = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ id: 'tier-new', minValue: 5 }),
    };
    const db = { select: jest.fn(() => read), insert: jest.fn(() => insert) } as never;
    await expect(
      createStatStrengthService(db).createStrength('user', {
        storyId: 'story',
        statId: null,
        minValue: 5,
        label: 'Novice',
      } as never),
    ).resolves.toEqual({ id: 'tier-new', minValue: 5 });
    expect(mockOperation).toHaveBeenCalledWith(
      db,
      'story',
      undefined,
      'create',
      'StatStrength',
      'tier-new',
      expect.any(Object),
    );
    expect(mockEmit).toHaveBeenCalledWith('stat_strength_changed', 'story');
  });
});
