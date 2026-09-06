const mockDb = {};
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn(() => mockDb) }));
jest.mock('../../src/services/storymanagement/StoryArcService', () => ({
  __esModule: true,
  createStoryArcService: jest.fn(),
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
import { useAppearsInArcs } from '../../src/hooks/useAppearsInArcs';
import { createStoryArcService } from '../../src/services/storymanagement/StoryArcService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const service = {
  listArcsForCharacter: jest.fn(),
  listArcsForLocation: jest.fn(),
  listArcsForItem: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  service.listArcsForCharacter.mockResolvedValue([{ id: 'arc-character' }]);
  service.listArcsForLocation.mockResolvedValue([{ id: 'arc-location' }]);
  service.listArcsForItem.mockResolvedValue([{ id: 'arc-item' }]);
  (createStoryArcService as jest.Mock).mockReturnValue(service);
});

describe('useAppearsInArcs', () => {
  it.each([
    ['character', 'listArcsForCharacter', 'arc-character'],
    ['location', 'listArcsForLocation', 'arc-location'],
    ['item', 'listArcsForItem', 'arc-item'],
  ] as const)(
    'loads %s membership from its matching service query',
    async (kind, method, arcId) => {
      const view = await renderHook(() => useAppearsInArcs('story', kind, 'entity'));
      await waitFor(() => expect(view.result.current).toMatchObject([{ id: arcId }]));
      expect(service[method]).toHaveBeenCalledWith('story', 'entity');
    },
  );

  it('refreshes only when its story changes and clears without an entity', async () => {
    const view = await renderHook<
      ReturnType<typeof useAppearsInArcs>,
      { storyId: string; entityId: string }
    >(({ storyId, entityId }) => useAppearsInArcs(storyId, 'character', entityId), {
      initialProps: { storyId: 'story', entityId: 'entity' },
    });
    await waitFor(() => expect(service.listArcsForCharacter).toHaveBeenCalledTimes(1));

    await act(async () => entityEventEmitter.emit('character_scene_changed', 'other-story'));
    expect(service.listArcsForCharacter).toHaveBeenCalledTimes(1);
    await act(async () => entityEventEmitter.emit('character_scene_changed', 'story'));
    await waitFor(() => expect(service.listArcsForCharacter).toHaveBeenCalledTimes(2));

    await act(async () => view.rerender({ storyId: 'story', entityId: '' }));
    await waitFor(() => expect(view.result.current).toEqual([]));
  });
});
