const mockGetEntityTable = jest.fn();
const mockSummarize = jest.fn();
jest.mock('../../src/services/entityTableRegistry', () => ({
  __esModule: true,
  getEntityTable: (...args: unknown[]) => mockGetEntityTable(...args),
}));
jest.mock('@keres/shared', () => ({
  __esModule: true,
  summarizeBoardEntity: (...args: unknown[]) => mockSummarize(...args),
}));

import { createEntityPreviewService } from '../../src/services/EntityPreviewService';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EntityPreviewService', () => {
  it('returns null for unregistered entities and absent live rows', async () => {
    const db = { select: jest.fn() } as never;
    mockGetEntityTable
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce({ id: 'id', isDeleted: 'isDeleted' });
    const query = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue(undefined),
    };
    (db as any).select.mockReturnValue(query);
    const service = createEntityPreviewService(db);
    await expect(service.getBoardSummary('Character' as never, 'missing')).resolves.toBeNull();
    await expect(service.getBoardSummary('Character' as never, 'missing')).resolves.toBeNull();
  });

  it('summarizes the registered live local row', async () => {
    const table = { id: 'id', isDeleted: 'isDeleted' };
    const query = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ id: 'char-1', name: 'Mira' }),
    };
    mockGetEntityTable.mockReturnValue(table);
    mockSummarize.mockReturnValue({ title: 'Mira' });
    const service = createEntityPreviewService({ select: jest.fn(() => query) } as never);
    await expect(service.getBoardSummary('Character' as never, 'char-1')).resolves.toEqual({
      title: 'Mira',
    });
    expect(mockSummarize).toHaveBeenCalledWith('Character', { id: 'char-1', name: 'Mira' });
  });
});
