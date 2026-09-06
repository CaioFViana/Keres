const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/StatService', () => ({
  __esModule: true,
  createStatService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/StatStrengthService', () => ({
  __esModule: true,
  createStatStrengthService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/ModeService', () => ({
  __esModule: true,
  createModeService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/StatRelationService', () => ({
  __esModule: true,
  createStatRelationService: jest.fn(),
}));
jest.mock('../../src/hooks/useEntityRefreshLifecycle', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    useEntityInitialLoad: (load: () => Promise<void>) =>
      React.useEffect(() => {
        void load();
      }, [load]),
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { createCharacterService } from '../../src/services/storymanagement/CharacterService';
import { createModeService } from '../../src/services/storymanagement/ModeService';
import { createStatRelationService } from '../../src/services/storymanagement/StatRelationService';
import { createStatService } from '../../src/services/storymanagement/StatService';
import { createStatStrengthService } from '../../src/services/storymanagement/StatStrengthService';
import { useStoryStats } from '../../src/hooks/useStoryStats';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

beforeEach(() => {
  jest.clearAllMocks();
  (createCharacterService as jest.Mock).mockReturnValue({
    getCharactersByStoryId: jest.fn().mockResolvedValue([{ id: 'character-1', name: 'Ari' }]),
  });
  (createStatService as jest.Mock).mockReturnValue({
    getStatsByStoryId: jest.fn().mockResolvedValue([
      { id: 'strength', name: 'Strength', isPrimary: true },
      { id: 'luck', isPrimary: false },
    ]),
  });
  (createStatStrengthService as jest.Mock).mockReturnValue({
    getStrengthsByStoryId: jest.fn().mockResolvedValue([
      { id: 'default', statId: null, label: 'Normal', minValue: 0 },
      { id: 'strength-high', statId: 'strength', label: 'Strong', minValue: 10 },
    ]),
  });
  (createModeService as jest.Mock).mockReturnValue({
    getModesByStoryId: jest.fn().mockResolvedValue([]),
  });
  (createStatRelationService as jest.Mock).mockReturnValue({
    getValuesByStoryId: jest
      .fn()
      .mockResolvedValue([
        { characterId: 'character-1', modeId: null, statId: 'strength', value: 12 },
      ]),
  });
});

describe('useStoryStats', () => {
  it('provides one indexed statistics model with default and per-stat ladders', async () => {
    const view = await renderHook(() => useStoryStats('story'));
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(view.result.current.primaryStats.map((stat) => stat.id)).toEqual(['strength']);
    expect(view.result.current.valueIndex.get('character-1::strength')).toBe(12);
    expect(view.result.current.ladderOf('strength')).toEqual([
      { label: '—', minValue: 0 },
      { id: 'strength-high', label: 'Strong', minValue: 10 },
    ]);
    expect(view.result.current.defaultLadder).toEqual([
      { id: 'default', label: 'Normal', minValue: 0 },
    ]);
    expect(view.result.current.ladderOf('luck')).toEqual([
      { id: 'default', label: 'Normal', minValue: 0 },
    ]);
  });

  it('reloads after stat changes and clears the model with no selected story', async () => {
    const view = await renderHook<
      ReturnType<typeof useStoryStats>,
      { storyId: string | undefined }
    >(({ storyId }) => useStoryStats(storyId), {
      initialProps: { storyId: 'story' as string | undefined },
    });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    const service = (createStatService as jest.Mock).mock.results[0].value;

    await act(async () => {
      entityEventEmitter.emit('stat_relation_changed', 'story');
    });
    await waitFor(() => expect(service.getStatsByStoryId).toHaveBeenCalledTimes(2));

    await act(async () => view.rerender({ storyId: undefined }));
    expect(view.result.current).toMatchObject({
      characters: [],
      stats: [],
      values: [],
      loading: false,
    });
  });
});
