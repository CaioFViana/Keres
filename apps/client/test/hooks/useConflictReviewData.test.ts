const mockDb = {};
const mockT = (key: string) => key;
const mockCollectConflictEntityRefs = jest.fn();
const mockCollectEntityRefs = jest.fn();
const mockBuildConflictSummaries = jest.fn();
const mockResolveSnapshots = jest.fn();
const mockResolveNames = jest.fn();

jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('react-i18next', () => ({
  __esModule: true,
  useTranslation: jest.fn(() => ({ t: mockT })),
}));
jest.mock('../../src/services/ConflictSummaryService', () => ({
  __esModule: true,
  collectConflictEntityRefs: (...args: unknown[]) => mockCollectConflictEntityRefs(...args),
  collectEntityRefs: (...args: unknown[]) => mockCollectEntityRefs(...args),
  buildConflictSummaries: (...args: unknown[]) => mockBuildConflictSummaries(...args),
}));
jest.mock('../../src/services/EntityNameBatchResolver', () => ({
  __esModule: true,
  createEntitySnapshotResolver: jest.fn(() => ({
    resolveMany: (...args: unknown[]) => mockResolveSnapshots(...args),
  })),
  createEntityNameBatchResolver: jest.fn(() => ({
    resolveMany: (...args: unknown[]) => mockResolveNames(...args),
  })),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useConflictReviewData } from '../../src/hooks/useConflictReviewData';

const noConflicts: never[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockCollectConflictEntityRefs.mockReturnValue([
    { entityType: 'Character', entityId: 'character-1' },
  ]);
  mockResolveSnapshots.mockResolvedValue(new Map([['Character:character-1', { name: 'Mira' }]]));
  mockCollectEntityRefs.mockReturnValue([{ entityType: 'Character', entityId: 'character-1' }]);
  mockResolveNames.mockResolvedValue(new Map([['Character:character-1', 'Mira']]));
  mockBuildConflictSummaries.mockReturnValue([{ id: 'conflict-1', label: 'Mira' }]);
});

describe('useConflictReviewData', () => {
  it('resolves snapshots and names before building conflict summaries', async () => {
    const conflicts = [{ id: 'conflict-1' }] as never;
    const view = await renderHook(() => useConflictReviewData(conflicts));
    await waitFor(() =>
      expect(view.result.current.summaries).toEqual([{ id: 'conflict-1', label: 'Mira' }]),
    );

    expect(mockResolveSnapshots).toHaveBeenCalledWith([
      { entityType: 'Character', entityId: 'character-1' },
    ]);
    expect(mockResolveNames).toHaveBeenCalledWith([
      { entityType: 'Character', entityId: 'character-1' },
    ]);
    expect(mockBuildConflictSummaries).toHaveBeenLastCalledWith(
      conflicts,
      expect.any(Map),
      expect.any(Map),
      mockT,
    );
  });

  it('clears resolvers for conflicts without entity references', async () => {
    mockCollectConflictEntityRefs.mockReturnValue([]);
    mockBuildConflictSummaries.mockReturnValue([]);
    const view = await renderHook(() => useConflictReviewData(noConflicts));
    await waitFor(() => expect(view.result.current.summaries).toEqual([]));

    expect(mockResolveSnapshots).not.toHaveBeenCalled();
    expect(mockResolveNames).not.toHaveBeenCalled();
    expect(mockBuildConflictSummaries).toHaveBeenCalledWith(
      noConflicts,
      expect.any(Map),
      expect.any(Map),
      mockT,
    );
  });
});
