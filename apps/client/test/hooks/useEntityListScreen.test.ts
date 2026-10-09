/**
 * @jest-environment node
 */
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('../../src/state/storyStore', () => ({ __esModule: true, useStoryStore: jest.fn() }));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useEntityListScreen } from '../../src/hooks/useEntityListScreen';
import { useStoryStore } from '../../src/state/storyStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const STORY_ID = 'story-1';
const CHANGE_EVENT = 'tag_changed';
const fakeDb = { marker: 'db' } as never;

function buildStore(overrides: Record<string, unknown> = {}) {
  return {
    tags: [{ id: 't1' }],
    fetchTags: jest.fn(async () => undefined),
    searchTerm: '',
    activeFilterTags: [],
    activeSort: null,
    sortDirection: 'asc',
    favoriteFilterState: 'all',
    advancedSearchCriteria: {},
    loading: false,
    error: null,
    setSearchTerm: jest.fn(),
    setDbAndStoryId: jest.fn(),
    initializeService: jest.fn(),
    setSort: jest.fn(),
    setFilterTags: jest.fn(),
    setFavoriteFilter: jest.fn(),
    setAdvancedSearchCriteria: jest.fn(),
    findMatching: jest.fn(async (_criteria: unknown) => [{ id: 'a' }, { id: 'b' }, { id: 'c' }]),
    toggleFavorite: jest.fn(),
    ...overrides,
  };
}

let store: ReturnType<typeof buildStore>;

const render = (options: Record<string, unknown> = {}) =>
  renderHook(() =>
    useEntityListScreen({
      useStore: () => store as never,
      collectionKey: 'tags',
      changeEvent: CHANGE_EVENT,
      ...options,
    } as never),
  );

beforeEach(() => {
  jest.useFakeTimers();
  store = buildStore();
  (useDrizzle as jest.Mock).mockReturnValue(fakeDb);
  (useStoryStore as unknown as jest.Mock).mockReturnValue({ selectedStory: { id: STORY_ID } });
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('bootstrapping', () => {
  it('only reports the blocking loading state until the first response for a story', async () => {
    let resolveFetch: (() => void) | undefined;
    store = buildStore({
      fetchTags: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    });

    const { result } = await render();
    expect(result.current.isInitialLoading).toBe(true);

    await act(async () => resolveFetch?.());
    await waitFor(() => expect(result.current.isInitialLoading).toBe(false));
  });

  it('hands the store the database and the open story', async () => {
    await render();

    expect(store.setDbAndStoryId).toHaveBeenCalledWith(fakeDb, STORY_ID);
    expect(store.initializeService).toHaveBeenCalled();
  });

  it('does not bootstrap without an open story', async () => {
    (useStoryStore as unknown as jest.Mock).mockReturnValue({ selectedStory: null });

    await render();

    expect(store.setDbAndStoryId).not.toHaveBeenCalled();
  });

  it('exposes the collection and the fetch action derived from the collection key', async () => {
    const { result } = await render();

    expect(result.current.items).toEqual([{ id: 't1' }]);
    await act(async () => {
      await result.current.refetch();
    });
    expect(store.fetchTags).toHaveBeenCalled();
  });

  it('fetches once the screen mounts', async () => {
    await render();

    await waitFor(() => expect(store.fetchTags).toHaveBeenCalled());
  });

  it('refetches when the open story changes', async () => {
    const { rerender } = await render();
    store.fetchTags.mockClear();
    (useStoryStore as unknown as jest.Mock).mockReturnValue({ selectedStory: { id: 'story-2' } });

    await rerender(undefined as never);

    await waitFor(() => expect(store.fetchTags).toHaveBeenCalled());
  });
});

/**
 * The search is two-tiered on purpose: the field responds to every keystroke, and the query only goes
 * out when the typing stops. Without that every letter would fire a query.
 */
describe('search', () => {
  it('updates the input on every keystroke without querying', async () => {
    const { result } = await render();

    await act(async () => result.current.handleSearch('an'));

    expect(result.current.searchQuery).toBe('an');
    expect(store.setSearchTerm).not.toHaveBeenCalledWith('an');
  });

  it('commits the term once typing pauses', async () => {
    const { result } = await render();

    await act(async () => result.current.handleSearch('ana'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(store.setSearchTerm).toHaveBeenCalledWith('ana');
  });

  it('collapses a burst of keystrokes into a single commit', async () => {
    const { result } = await render();

    await act(async () => result.current.handleSearch('a'));
    await act(async () => result.current.handleSearch('an'));
    await act(async () => result.current.handleSearch('ana'));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(store.setSearchTerm.mock.calls.filter(([term]: [string]) => term !== '')).toEqual([
      ['ana'],
    ]);
  });

  it('commits immediately on submit, skipping the wait', async () => {
    const { result } = await render();

    await act(async () => result.current.handleSearch('ana'));
    await act(async () => result.current.handleSearchSubmit());

    expect(store.setSearchTerm).toHaveBeenCalledWith('ana');
  });

  it('commits the term it is given, not the one the box held a moment ago', async () => {
    const { result } = await render();
    await act(async () => result.current.handleSearch('ana'));

    await act(async () => result.current.handleSearchSubmit(''));

    expect(store.setSearchTerm).toHaveBeenLastCalledWith('');
  });

  it('waits a quarter of a second by default: a local query should feel live', async () => {
    const { result } = await render();
    store.setSearchTerm.mockClear();

    await act(async () => result.current.handleSearch('ana'));
    await act(async () => {
      jest.advanceTimersByTime(249);
    });
    expect(store.setSearchTerm).not.toHaveBeenCalledWith('ana');

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(store.setSearchTerm).toHaveBeenCalledWith('ana');
  });

  it('does not commit again after a submit', async () => {
    const { result } = await render();
    await act(async () => result.current.handleSearch('ana'));
    await act(async () => result.current.handleSearchSubmit());
    store.setSearchTerm.mockClear();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(store.setSearchTerm).not.toHaveBeenCalled();
  });

  it('honours a custom debounce window', async () => {
    const { result } = await render({ searchDebounceMs: 300 });

    await act(async () => result.current.handleSearch('ana'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(store.setSearchTerm).toHaveBeenCalledWith('ana');
  });

  it('drops a pending commit when the screen goes away mid-typing', async () => {
    const { result, unmount } = await render();
    await act(async () => result.current.handleSearch('ana'));

    await unmount();
    store.setSearchTerm.mockClear();
    jest.advanceTimersByTime(2000);

    expect(store.setSearchTerm).not.toHaveBeenCalled();
  });
});

describe('filters and sorting', () => {
  it('keeps the direction when only the sort column changes', async () => {
    store = buildStore({ sortDirection: 'desc' });
    const { result } = await render();

    await act(async () => result.current.handleSortChange('name'));

    expect(store.setSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('keeps the column when only the direction changes', async () => {
    store = buildStore({ activeSort: 'name' });
    const { result } = await render();

    await act(async () => result.current.handleSortDirectionChange('desc'));

    expect(store.setSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('passes the other filters straight to the store', async () => {
    const { result } = await render();

    await act(async () => result.current.handleFilterTagsChange(['t1']));
    await act(async () => result.current.handleFavoriteFilterChange('favorite'));

    expect(store.setFilterTags).toHaveBeenCalledWith(['t1']);
    expect(store.setFavoriteFilter).toHaveBeenCalledWith('favorite');
  });

  it('refetches when the committed filter state changes', async () => {
    const { rerender } = await render();
    store.fetchTags.mockClear();

    store = buildStore({ activeSort: 'name', fetchTags: store.fetchTags });
    await rerender(undefined as never);

    await waitFor(() => expect(store.fetchTags).toHaveBeenCalled());
  });
});

describe('reacting to changes elsewhere in the app', () => {
  it('refetches when the entity changes in the open story', async () => {
    await render();
    store.fetchTags.mockClear();

    await act(async () => {
      entityEventEmitter.emit(CHANGE_EVENT, STORY_ID);
    });

    expect(store.fetchTags).toHaveBeenCalled();
  });

  it('ignores a change in another story', async () => {
    await render();
    store.fetchTags.mockClear();

    await act(async () => {
      entityEventEmitter.emit(CHANGE_EVENT, 'outra-historia');
    });

    expect(store.fetchTags).not.toHaveBeenCalled();
  });

  it('ignores an event meant for another entity', async () => {
    await render();
    store.fetchTags.mockClear();

    await act(async () => {
      entityEventEmitter.emit('scene_changed', STORY_ID);
    });

    expect(store.fetchTags).not.toHaveBeenCalled();
  });

  it('stops listening once the screen goes away', async () => {
    const { unmount } = await render();
    await unmount();
    store.fetchTags.mockClear();

    entityEventEmitter.emit(CHANGE_EVENT, STORY_ID);

    expect(store.fetchTags).not.toHaveBeenCalled();
  });
});

describe('previewing the field filters', () => {
  it('counts the rows the store finds with other criteria', async () => {
    const { result } = await render();

    const count = await result.current.listProps.onPreviewCount({ name: 'x' });

    expect(store.findMatching).toHaveBeenCalledWith({ name: 'x' });
    expect(count).toBe(3);
  });

  it('hands the rows themselves to a screen that has to narrow the count further', async () => {
    const { result } = await render();

    expect(await result.current.findMatching({ name: 'x' })).toHaveLength(3);
  });
});

describe('favorites', () => {
  it('toggles through the store and resolves once the store has', async () => {
    let finishToggle: (() => void) | undefined;
    store = buildStore({
      toggleFavorite: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            finishToggle = resolve;
          }),
      ),
    });
    const { result } = await render();

    let settled = false;
    const pending = result.current.handleToggleFavorite('t1', true).then(() => {
      settled = true;
    });

    expect(store.toggleFavorite).toHaveBeenCalledWith('t1', true);
    await act(async () => {});
    expect(settled).toBe(false);

    finishToggle?.();
    await pending;
    expect(settled).toBe(true);
  });
});

describe('another story', () => {
  it('empties the search box', async () => {
    const { result, rerender } = await render();
    await act(async () => result.current.handleSearch('ana'));

    (useStoryStore as unknown as jest.Mock).mockReturnValue({ selectedStory: { id: 'story-2' } });
    await rerender(undefined as never);

    expect(result.current.searchQuery).toBe('');
  });

  it('keeps what was typed when the story merely finishes loading', async () => {
    (useStoryStore as unknown as jest.Mock).mockReturnValue({ selectedStory: null });
    const { result, rerender } = await render();
    await act(async () => result.current.handleSearch('ana'));

    (useStoryStore as unknown as jest.Mock).mockReturnValue({ selectedStory: { id: STORY_ID } });
    await rerender(undefined as never);

    expect(result.current.searchQuery).toBe('ana');
  });
});
