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
import { useEntityArcIds } from '../../src/hooks/useEntityArcIds';
import { createStoryArcService } from '../../src/services/storymanagement/StoryArcService';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const service = {
  listEntityArcIds: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  service.listEntityArcIds.mockResolvedValue(new Map([['entity', ['arc-1']]]));
  (createStoryArcService as jest.Mock).mockReturnValue(service);
});

describe('useEntityArcIds', () => {
  it.each([['character'], ['location'], ['item']] as const)(
    'loads %s membership from the bulk service query',
    async (kind) => {
      const view = await renderHook(() => useEntityArcIds('story', kind));
      await waitFor(() => expect(view.result.current).toEqual(new Map([['entity', ['arc-1']]])));
      expect(service.listEntityArcIds).toHaveBeenCalledWith('story', kind);
    },
  );

  it('refreshes only when its story changes and clears without a story', async () => {
    const view = await renderHook<ReturnType<typeof useEntityArcIds>, { storyId: string }>(
      ({ storyId }) => useEntityArcIds(storyId, 'item'),
      {
        initialProps: { storyId: 'story' },
      },
    );
    await waitFor(() => expect(service.listEntityArcIds).toHaveBeenCalledTimes(1));

    await act(async () => entityEventEmitter.emit('item_journey_changed', 'other-story'));
    expect(service.listEntityArcIds).toHaveBeenCalledTimes(1);
    await act(async () => entityEventEmitter.emit('item_journey_changed', 'story'));
    await waitFor(() => expect(service.listEntityArcIds).toHaveBeenCalledTimes(2));

    await act(async () => view.rerender({ storyId: '' }));
    await waitFor(() => expect(view.result.current).toEqual(new Map()));
  });
});
