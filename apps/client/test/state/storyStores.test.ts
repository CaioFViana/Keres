/** @jest-environment node */
import { useStoryListStore } from '../../src/state/storyListStore';
import { useStoryStore } from '../../src/state/storyStore';
import { useSummaryStore } from '../../src/state/summaryStore';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const story = (id: string, isFavorite = false) => ({ id, title: id, isFavorite }) as never;

beforeEach(() => {
  useStoryStore.getState().setSelectedStory(null);
  useStoryListStore.getState().setStories([]);
  useSummaryStore.getState().clearSummary();
  useUserSettingsStore.setState({ userId: null });
});

describe('story state stores', () => {
  it('keeps the selected story explicit and clears it without retaining prior data', () => {
    useStoryStore.getState().setSelectedStory(story('selected'));
    expect(useStoryStore.getState().selectedStory?.id).toBe('selected');
    useStoryStore.getState().setSelectedStory(null);
    expect(useStoryStore.getState().selectedStory).toBeNull();
  });

  it('updates only the targeted story and announces every list mutation', async () => {
    const listener = jest.fn();
    entityEventEmitter.on('story_changed', listener);
    try {
      useStoryListStore.getState().setStories([story('first'), story('second')]);
      useStoryListStore.getState().updateStoryFavoriteStatus('second', true);
      useStoryListStore.getState().updateStory(story('first', true));
      useStoryListStore.getState().removeStory('second');

      expect(useStoryListStore.getState().stories).toEqual([story('first', true)]);
      expect(listener.mock.calls.map(([id]) => id)).toEqual(['second', 'first', 'second']);
    } finally {
      entityEventEmitter.off('story_changed', listener);
    }
  });

  it('fetches stories for the configured local user and preserves the last good list on failure', async () => {
    useUserSettingsStore.setState({ userId: 'user-1' });
    const service = { getAllStories: jest.fn().mockResolvedValue([story('remote')]) } as never;
    await useStoryListStore.getState().fetchStories(service);
    expect((service as any).getAllStories).toHaveBeenCalledWith('user-1');
    expect(useStoryListStore.getState().stories.map((entry) => entry.id)).toEqual(['remote']);

    jest.spyOn(console, 'error').mockImplementation(() => {});
    await useStoryListStore
      .getState()
      .fetchStories({ getAllStories: jest.fn().mockRejectedValue(new Error('offline')) } as never);
    expect(useStoryListStore.getState().stories.map((entry) => entry.id)).toEqual(['remote']);
  });

  it('clears a stale dashboard summary', () => {
    useSummaryStore.getState().updateSummary({ totalStories: 1 } as never);
    expect(useSummaryStore.getState().summary?.totalStories).toBe(1);
    useSummaryStore.getState().clearSummary();
    expect(useSummaryStore.getState().summary).toBeNull();
  });
});
