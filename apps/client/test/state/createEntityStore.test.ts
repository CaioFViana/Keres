jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockFavoriteService = {
  getBehavior: jest.fn(async () => 'global' as string),
  setFavorite: jest.fn(async () => undefined),
  decorateEntities: jest.fn(
    async (_storyId: string, _type: string, _userId: string, entities: any[]) => entities,
  ),
};

jest.mock('../../src/services/storymanagement/FavoriteService', () => ({
  createFavoriteService: jest.fn(() => mockFavoriteService),
}));

let mockUserId: string | null = 'user-1';
jest.mock('../../src/state/userSettingsStore', () => ({
  useUserSettingsStore: { getState: () => ({ userId: mockUserId }) },
}));

import { createEntityStore, type EntityQueryParams } from '../../src/state/createEntityStore';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

interface Tag {
  id: string;
  name: string;
  isFavorite: boolean;
}

const tag = (id: string, isFavorite = false): Tag => ({ id, name: `Tag ${id}`, isFavorite });

const fakeDb = {} as any;

/** Os setters disparam a busca sem esperar por ela; isto drena a fila de microtasks. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Esta fábrica gera as 17 stores de lista de entidade do app - cobrir a fábrica cobre todas.
 * O que interessa é o contrato compartilhado: nomes de chave derivados de `collectionKey`,
 * quando a busca é refeita, e o comportamento otimista do favorito (que escreve na tela antes
 * de escrever no banco e precisa desfazer sozinho quando a escrita falha).
 */
function buildStore(overrides: Partial<Parameters<typeof createEntityStore>[0]> = {}) {
  const fetchEntities = jest.fn(async (_service: unknown, _params: EntityQueryParams) => [
    tag('a'),
    tag('b'),
  ]);
  const updateFavorite = jest.fn(async () => undefined);
  const createService = jest.fn(() => ({ name: 'TagService' }));

  const store = createEntityStore<'tags', Tag, { name: string }>({
    collectionKey: 'tags',
    favoriteEntityType: 'Tag' as any,
    createService,
    fetchEntities,
    updateFavorite,
    changeEvent: 'tag_changed',
    ...(overrides as any),
  });

  return { store, fetchEntities, updateFavorite, createService };
}

/** A store nasce pronta para buscar: db, storyId e service configurados. */
function readyStore(overrides: Parameters<typeof buildStore>[0] = {}) {
  const built = buildStore(overrides);
  built.store.getState().setDbAndStoryId(fakeDb, 'story-1');
  built.store.getState().initializeService();
  built.fetchEntities.mockClear();
  return built;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUserId = 'user-1';
  mockFavoriteService.getBehavior.mockResolvedValue('global');
  mockFavoriteService.decorateEntities.mockImplementation(
    async (_s, _t, _u, entities: any[]) => entities,
  );
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('store shape', () => {
  it('names the collection and the fetch action after the collection key', () => {
    const { store } = buildStore();
    const state = store.getState() as any;

    expect(state.tags).toEqual([]);
    expect(typeof state.fetchTags).toBe('function');
  });

  it('starts with no db, story or service', () => {
    const state = buildStore().store.getState();

    expect(state).toMatchObject({
      db: null,
      storyId: null,
      service: null,
      loading: false,
      error: null,
    });
  });

  it('starts with a neutral filter and sort selection', () => {
    const state = buildStore().store.getState();

    expect(state).toMatchObject({
      searchTerm: '',
      activeFilterTags: [],
      favoriteFilterState: 'all',
      activeSort: null,
      sortDirection: 'asc',
      advancedSearchCriteria: {},
    });
  });

  it('honours the configured default sort', () => {
    const state = buildStore({
      defaultSort: 'name',
      defaultSortDirection: 'desc',
    } as any).store.getState();

    expect(state).toMatchObject({ activeSort: 'name', sortDirection: 'desc' });
  });
});

describe('service bootstrapping', () => {
  it('creates the service once the db is known', () => {
    const { store, createService } = buildStore();

    store.getState().setDbAndStoryId(fakeDb, 'story-1');
    store.getState().initializeService();

    expect(createService).toHaveBeenCalledWith(fakeDb);
    expect(store.getState().service).not.toBeNull();
  });

  it('does not create a second service on a repeated initialize', () => {
    const { store, createService } = buildStore();
    store.getState().setDbAndStoryId(fakeDb, 'story-1');

    store.getState().initializeService();
    store.getState().initializeService();

    expect(createService).toHaveBeenCalledTimes(1);
  });

  it('does nothing when there is no db yet', () => {
    const { store, createService } = buildStore();

    store.getState().initializeService();

    expect(createService).not.toHaveBeenCalled();
    expect(store.getState().service).toBeNull();
  });
});

describe('fetching', () => {
  it('loads the entities into the collection', async () => {
    const { store } = readyStore();

    await (store.getState() as any).fetchTags();

    expect((store.getState() as any).tags).toEqual([tag('a'), tag('b')]);
    expect(store.getState().loading).toBe(false);
  });

  it('passes the current filter and sort state to the service', async () => {
    const { store, fetchEntities } = readyStore();
    store.setState({
      searchTerm: 'ana',
      activeFilterTags: ['t1'],
      activeSort: 'name',
      sortDirection: 'desc',
    } as any);

    await (store.getState() as any).fetchTags();

    expect(fetchEntities.mock.calls[0][1]).toMatchObject({
      storyId: 'story-1',
      searchTerm: 'ana',
      activeFilterTags: ['t1'],
      activeSort: 'name',
      sortDirection: 'desc',
    });
  });

  it('clears the collection instead of querying when there is no service', async () => {
    const { store, fetchEntities } = buildStore();
    store.setState({ tags: [tag('a')] } as any);

    await (store.getState() as any).fetchTags();

    expect((store.getState() as any).tags).toEqual([]);
    expect(fetchEntities).not.toHaveBeenCalled();
  });

  it('surfaces a fetch failure as an error message and stops loading', async () => {
    const { store, fetchEntities } = readyStore();
    fetchEntities.mockRejectedValue(new Error('banco fora'));

    await (store.getState() as any).fetchTags();

    expect(store.getState().error).toBe('Failed to load tags.');
    expect(store.getState().loading).toBe(false);
  });

  it('uses the configured error message when there is one', async () => {
    const { store, fetchEntities } = readyStore({
      errorMessages: { fetch: 'Não deu para carregar as tags.' },
    } as any);
    fetchEntities.mockRejectedValue(new Error('banco fora'));

    await (store.getState() as any).fetchTags();

    expect(store.getState().error).toBe('Não deu para carregar as tags.');
  });

  it('clears a previous error on a successful refetch', async () => {
    const { store, fetchEntities } = readyStore();
    fetchEntities.mockRejectedValueOnce(new Error('banco fora'));

    await (store.getState() as any).fetchTags();
    fetchEntities.mockResolvedValue([tag('a')]);
    await (store.getState() as any).fetchTags();

    expect(store.getState().error).toBeNull();
  });
});

describe('filter and sort setters', () => {
  it.each([
    ['setFilterTags', (state: any) => state.setFilterTags(['t1']), { activeFilterTags: ['t1'] }],
    [
      'setFavoriteFilter',
      (state: any) => state.setFavoriteFilter('favorite'),
      { favoriteFilterState: 'favorite' },
    ],
    [
      'setSort',
      (state: any) => state.setSort('name', 'desc'),
      { activeSort: 'name', sortDirection: 'desc' },
    ],
    [
      'setAdvancedSearchCriteria',
      (state: any) => state.setAdvancedSearchCriteria({ name: 'ana' }),
      { advancedSearchCriteria: { name: 'ana' } },
    ],
  ])('%s applies the change and refetches', async (_label, act, expected) => {
    const { store, fetchEntities } = readyStore();

    act(store.getState());
    await flush();

    expect(store.getState()).toMatchObject(expected);
    expect(fetchEntities).toHaveBeenCalledTimes(1);
  });

  it('does not refetch on every keystroke by default, since the screen debounces', async () => {
    const { store, fetchEntities } = readyStore();

    store.getState().setSearchTerm('an');
    await flush();

    expect(store.getState().searchTerm).toBe('an');
    expect(fetchEntities).not.toHaveBeenCalled();
  });

  it('refetches on search when the store opts in', async () => {
    const { store, fetchEntities } = readyStore({ fetchOnSearchTermChange: true } as any);

    store.getState().setSearchTerm('an');
    await flush();

    expect(fetchEntities).toHaveBeenCalledTimes(1);
  });
});

describe('toggleFavorite', () => {
  it('updates the row on screen before the write finishes', async () => {
    const { store } = readyStore();
    store.setState({ tags: [tag('a'), tag('b')] } as any);

    const pending = store.getState().toggleFavorite('a', true);

    expect((store.getState() as any).tags[0].isFavorite).toBe(true);
    await pending;
  });

  it('writes through the entity service when favourites are global to the story', async () => {
    const { store, updateFavorite } = readyStore();
    store.setState({ tags: [tag('a')] } as any);
    mockFavoriteService.getBehavior.mockResolvedValue('global');

    await store.getState().toggleFavorite('a', true);

    expect(updateFavorite).toHaveBeenCalledWith(expect.anything(), 'user-1', 'a', true);
    expect(mockFavoriteService.setFavorite).not.toHaveBeenCalled();
  });

  it('writes a per-user favourite when the story keeps them individual', async () => {
    const { store, updateFavorite } = readyStore();
    store.setState({ tags: [tag('a')] } as any);
    mockFavoriteService.getBehavior.mockResolvedValue('individual');

    await store.getState().toggleFavorite('a', true);

    expect(mockFavoriteService.setFavorite).toHaveBeenCalledWith(
      'story-1',
      'a',
      'Tag',
      'user-1',
      true,
    );
    expect(updateFavorite).not.toHaveBeenCalled();
  });

  it('announces the change so open screens refresh', async () => {
    const { store } = readyStore();
    store.setState({ tags: [tag('a')] } as any);
    const listener = jest.fn();
    entityEventEmitter.on('tag_changed', listener);

    await store.getState().toggleFavorite('a', true);
    entityEventEmitter.off('tag_changed', listener);

    expect(listener).toHaveBeenCalledWith('story-1');
  });

  it('rolls the row back and reports an error when the write fails', async () => {
    const { store, updateFavorite } = readyStore();
    store.setState({ tags: [tag('a'), tag('b')] } as any);
    updateFavorite.mockRejectedValue(new Error('sem permissão'));

    await store.getState().toggleFavorite('a', true);

    expect((store.getState() as any).tags).toEqual([tag('a'), tag('b')]);
    expect(store.getState().error).toBe('Failed to update favorite status.');
  });

  it('leaves the other rows untouched', async () => {
    const { store } = readyStore();
    store.setState({ tags: [tag('a'), tag('b', true)] } as any);

    await store.getState().toggleFavorite('a', true);

    expect((store.getState() as any).tags[1]).toEqual(tag('b', true));
  });

  it('does nothing without a story or service', async () => {
    const { store, updateFavorite } = buildStore();

    await store.getState().toggleFavorite('a', true);

    expect(updateFavorite).not.toHaveBeenCalled();
  });

  it('does nothing when the local user is unknown', async () => {
    const { store, updateFavorite } = readyStore();
    store.setState({ tags: [tag('a')] } as any);
    mockUserId = null;

    await store.getState().toggleFavorite('a', true);

    expect(updateFavorite).not.toHaveBeenCalled();
    expect((store.getState() as any).tags[0].isFavorite).toBe(false);
  });

  it('does nothing for an entity type that has no favourite flag', async () => {
    const { store } = readyStore({
      updateFavorite: undefined,
      favoriteEntityType: undefined,
    } as any);
    store.setState({ tags: [tag('a')] } as any);

    await store.getState().toggleFavorite('a', true);

    expect(mockFavoriteService.setFavorite).not.toHaveBeenCalled();
  });
});

describe('resetStore', () => {
  it('drops the db, story, service and rows on story exit', async () => {
    const { store } = readyStore();
    await (store.getState() as any).fetchTags();
    store.getState().setSearchTerm('ana');

    store.getState().resetStore();

    expect(store.getState()).toMatchObject({
      db: null,
      storyId: null,
      service: null,
      searchTerm: '',
    });
    expect((store.getState() as any).tags).toEqual([]);
  });

  it('restores the configured default sort, not a blank one', () => {
    const { store } = readyStore({ defaultSort: 'name', defaultSortDirection: 'desc' } as any);
    store.getState().setSort('createdAt', 'asc');

    store.getState().resetStore();

    expect(store.getState()).toMatchObject({ activeSort: 'name', sortDirection: 'desc' });
  });
});

describe('extra actions', () => {
  it('exposes store-specific actions alongside the shared core', async () => {
    const { store } = readyStore({
      extraActions: ({ refetch, setPartial }: any) => ({
        reorder: async () => {
          setPartial({ activeSort: 'index' });
          await refetch();
        },
      }),
    } as any);

    await (store.getState() as any).reorder();

    expect(store.getState().activeSort).toBe('index');
    expect((store.getState() as any).tags).toEqual([tag('a'), tag('b')]);
  });
});
