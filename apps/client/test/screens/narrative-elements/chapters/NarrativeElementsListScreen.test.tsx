import {
  act,
  cleanup,
  fireEvent,
  render,
  type RenderResult,
  waitFor,
} from '@testing-library/react-native';
import { UNCHAPTERED_GROUP_ID } from '../../../../src/utils/narrativeSceneOrder';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockToggleFavorite = jest.fn();
const mockToggleSceneFavorite = jest.fn();
const mockFetchStoredScenes = jest.fn();
const mockSetSceneDbAndStoryId = jest.fn();
const mockInitializeSceneService = jest.fn();
const mockReorderScenes = jest.fn();
const mockReorderChapters = jest.fn();
const mockUseScreenTour = jest.fn();

const mockGetAllChapters = jest.fn();
const mockGetChaptersByStoryId = jest.fn();
const mockGetAllScenes = jest.fn();
const mockGetScenesByStoryId = jest.fn();
const mockGetAllChoices = jest.fn();
const mockGetChoicesByStoryId = jest.fn();
const mockGetTagsByStoryId = jest.fn();
const mockGetTagsForEntity = jest.fn();

const mockEmitterHandlers = new Map<string, Set<(...args: never[]) => void>>();
const mockEmitterOn: jest.Mock = jest.fn((event: string, listener: (...args: never[]) => void) => {
  const set = mockEmitterHandlers.get(event) ?? new Set();
  set.add(listener);
  mockEmitterHandlers.set(event, set);
});
const mockEmitterOff: jest.Mock = jest.fn((event: string, listener: (...args: never[]) => void) => {
  mockEmitterHandlers.get(event)?.delete(listener);
});

function emit(event: string, ...args: never[]) {
  mockEmitterHandlers.get(event)?.forEach((listener) => listener(...args));
}

let mockAlertButtons: { text: string; onPress?: () => void; style?: string }[] = [];
const mockAlert: jest.Mock = jest.fn(
  (_title: string, _message: string, buttons: { text: string; onPress?: () => void }[]) => {
    mockAlertButtons = buttons;
  },
);

let mockSelectedStory: { id: string; type: string } | null = { id: 'story-1', type: 'linear' };
let mockActiveArcId: string | null = null;
let mockCanEdit = true;
let mockStoredScenes: { id: string; isFavorite: boolean }[] = [];
let mockLoading = false;
let mockError: string | null = null;
let mockStoryId: string | undefined = 'story-1';
let mockSearchQuery = '';
let mockActiveSort: string | null = 'index';
let mockSortDirection: 'asc' | 'desc' = 'asc';
let mockFavoriteFilterState = 'all';
let mockAdvancedCriteria: Record<string, unknown> = {};
const mockListPropsValue = {};
let mockHeaderArgs: {
  title: string;
  actions: { id: string; label: string; onPress: () => void; visible: boolean }[];
} | null = null;
let mockListProps: {
  data: { id: string }[];
  onFilterChange: (ids: string[]) => void;
  emptyStateTitle?: string;
  emptyStateMessage?: string;
  emptyStateActions?: { label: string; onPress: () => void }[];
} | null = null;

jest.mock('@react-navigation/native', () => {
  let navigation: { navigate: (...args: never[]) => void; goBack: () => void } | null = null;
  return {
    __esModule: true,
    useNavigation: () => (navigation ??= { navigate: mockNavigate, goBack: mockGoBack }),
  };
});

jest.mock('../../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));

jest.mock('../../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (args: {
    title: string;
    actions: { id: string; onPress: () => void; visible: boolean }[];
  }) => {
    mockHeaderArgs = args as never;
  },
}));
jest.mock('../../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));

jest.mock('../../../../src/hooks/useEntityListScreen', () => ({
  __esModule: true,
  useEntityListScreen: () => ({
    listProps: mockListPropsValue,
    loading: mockLoading,
    error: mockError,
    storyId: mockStoryId,
    searchQuery: mockSearchQuery,
    activeSort: mockActiveSort,
    sortDirection: mockSortDirection,
    favoriteFilterState: mockFavoriteFilterState,
    advancedSearchCriteria: mockAdvancedCriteria,
    toggleFavorite: mockToggleFavorite,
  }),
}));

jest.mock('../../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: object) => unknown) =>
    selector({ selectedStory: mockSelectedStory, activeArcId: mockActiveArcId }),
}));

jest.mock('../../../../src/state/sceneStore', () => ({
  __esModule: true,
  useSceneStore: (selector: (state: object) => unknown) =>
    selector({
      scenes: mockStoredScenes,
      fetchScenes: mockFetchStoredScenes,
      toggleFavorite: mockToggleSceneFavorite,
      reorderScenes: mockReorderScenes,
      setDbAndStoryId: mockSetSceneDbAndStoryId,
      initializeService: mockInitializeSceneService,
    }),
}));

jest.mock('../../../../src/state/chapterStore', () => ({
  __esModule: true,
  useChapterStore: (selector: (state: object) => unknown) =>
    selector({ reorderChapters: mockReorderChapters }),
}));

jest.mock('../../../../src/db', () => {
  const db = {};
  return {
    __esModule: true,
    useDrizzle: () => db,
  };
});

jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      primary: '#0000ff',
      surface: '#f5f5f5',
      background: '#ffffff',
      border: '#cccccc',
      text: '#111111',
      textSecondary: '#555555',
    },
  }),
}));

jest.mock('../../../../src/vocabulary/useStoryVocabulary', () => {
  const term = (value: string, plural?: boolean) => (plural ? `${value}s` : value);
  return {
    __esModule: true,
    useStoryVocabulary: () => ({ term }),
  };
});

jest.mock('../../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

jest.mock('../../../../src/utils/EventEmitter', () => ({
  __esModule: true,
  entityEventEmitter: {
    on: (...args: unknown[]) => mockEmitterOn(...args),
    off: (...args: unknown[]) => mockEmitterOff(...args),
  },
}));

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return {
    __esModule: true,
    useTranslation: () => ({ t }),
  };
});

jest.mock('../../../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: () => ({
    getAllByStoryId: mockGetAllChapters,
    getChaptersByStoryId: mockGetChaptersByStoryId,
  }),
}));

jest.mock('../../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({
    getAllByStoryId: mockGetAllScenes,
    getScenesByStoryId: mockGetScenesByStoryId,
  }),
}));

jest.mock('../../../../src/services/storymanagement/ChoiceService', () => ({
  __esModule: true,
  createChoiceService: () => ({
    getAllByStoryId: mockGetAllChoices,
    getChoicesByStoryId: mockGetChoicesByStoryId,
  }),
}));

jest.mock('../../../../src/services/storymanagement/TagService', () => ({
  __esModule: true,
  createTagService: () => ({ getTagsByStoryId: mockGetTagsByStoryId }),
}));

jest.mock('../../../../src/services/storymanagement/TagRelationService', () => ({
  __esModule: true,
  createTagRelationService: () => ({ getTagsForEntity: mockGetTagsForEntity }),
}));

jest.mock(
  '../../../../src/screens/narrative-elements/chapters/createChapterListItemRenderer',
  () => {
    const actual = jest.requireActual(
      '../../../../src/screens/narrative-elements/chapters/createChapterListItemRenderer',
    ) as object;
    const { isUnchapteredGroup } = jest.requireActual(
      '../../../../src/utils/narrativeSceneOrder',
    ) as { isUnchapteredGroup: (id: string) => boolean };
    return {
      ...(actual as object),
      createChapterListItemRenderer: (deps: {
        scenesWithFavoriteState: { id: string; chapterId: string | null; isFavorite: boolean }[];
        handleViewDetails: (id: string) => void;
        handleOpenScene: (id: string) => void;
        handleAddScene: (id: string) => void;
        handleToggleFavorite: (id: string, fav: boolean) => void;
        handleToggleSceneFavorite: (id: string, fav: boolean) => void;
        setReorderChapterId: (id: string | null) => void;
      }) => {
        const Row = ({ item }: { item: { id: string; name: string; isFavorite: boolean } }) => {
          const { Text } = require('react-native');
          const scenes = deps.scenesWithFavoriteState.filter((scene) =>
            isUnchapteredGroup(item.id) ? !scene.chapterId : scene.chapterId === item.id,
          );
          return (
            <>
              <Text testID={`rowname-${item.id}`}>{item.name}</Text>
              <Text testID={`rowview-${item.id}`} onPress={() => deps.handleViewDetails(item.id)}>
                view
              </Text>
              <Text
                testID={`rowfav-${item.id}`}
                onPress={() => deps.handleToggleFavorite(item.id, !item.isFavorite)}
              >
                {`fav:${item.isFavorite}`}
              </Text>
              <Text testID={`rowaddscene-${item.id}`} onPress={() => deps.handleAddScene(item.id)}>
                add
              </Text>
              <Text
                testID={`rowreorder-${item.id}`}
                onPress={() => deps.setReorderChapterId(item.id)}
              >
                reorder
              </Text>
              {scenes.map((scene) => (
                <Text
                  key={scene.id}
                  testID={`sceneopen-${scene.id}`}
                  onPress={() => deps.handleOpenScene(scene.id)}
                >
                  {scene.id}
                </Text>
              ))}
              {scenes.map((scene) => (
                <Text
                  key={`fav-${scene.id}`}
                  testID={`scenefav-${scene.id}`}
                  onPress={() => deps.handleToggleSceneFavorite(scene.id, !scene.isFavorite)}
                >
                  {`sfav:${scene.isFavorite}`}
                </Text>
              ))}
            </>
          );
        };
        return Row;
      },
    };
  },
);

jest.mock(
  '../../../../src/components/common/lists/GenericFilterSortList/GenericFilterSortList',
  () => ({
    __esModule: true,
    default: (props: {
      data: { id: string; name: string }[];
      renderItem: (info: { item: { id: string; name: string } }) => React.ReactNode;
      searchPlaceholder: string;
      filterOptions: unknown[];
      onFilterChange: (ids: string[]) => void;
      selectedFilterValues: string[];
      sortOptions: unknown[];
      entityName: string;
      storyId: string;
      advancedSearchScopes: unknown[];
      resultsMeta: string;
    }) => {
      const React = require('react');
      const { Text } = require('react-native');
      mockListProps = props as never;
      return (
        <>
          <Text testID="list-meta">{props.resultsMeta}</Text>
          <Text testID="list-search">{props.searchPlaceholder}</Text>
          <Text testID="list-filters">
            {JSON.stringify({
              options: props.filterOptions,
              selected: props.selectedFilterValues,
              entity: props.entityName,
              storyId: props.storyId,
              sorts: props.sortOptions,
              scopes: props.advancedSearchScopes,
            })}
          </Text>
          <Text testID="list-filter-change" onPress={() => props.onFilterChange(['tag-1'])}>
            filter
          </Text>
          {props.data.map((item) => (
            <React.Fragment key={item.id}>{props.renderItem({ item })}</React.Fragment>
          ))}
        </>
      );
    },
  }),
);

jest.mock('../../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: ({ message }: { message: string }) => (
      <Text testID="screen-loading">{message}</Text>
    ),
    ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => (
      <Text testID="screen-error" onPress={onGoBack}>
        {message}
      </Text>
    ),
  };
});

jest.mock(
  '../../../../src/components/features/chapters/ChapterReorderModal/ChapterReorderModal',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({
        isVisible,
        onClose,
        chapters,
        onReorderConfirm,
      }: {
        isVisible: boolean;
        onClose: () => void;
        chapters: { id: string }[];
        onReorderConfirm: (order: { id: string; newIndex: number }[]) => void;
      }) => (
        <>
          <Text testID="chapter-reorder">
            {JSON.stringify({ isVisible, chapters: chapters.map((chapter) => chapter.id) })}
          </Text>
          <Text testID="chapter-reorder-close" onPress={onClose}>
            close
          </Text>
          <Text
            testID="chapter-reorder-confirm"
            onPress={() => onReorderConfirm([{ id: 'ch-1', newIndex: 0 }])}
          >
            confirm
          </Text>
        </>
      ),
    };
  },
);

jest.mock('../../../../src/components/features/scenes/SceneReorderModal/SceneReorderModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      isVisible,
      onClose,
      storyId,
      scenes,
      initialChapterId,
      onReorderConfirm,
    }: {
      isVisible: boolean;
      onClose: () => void;
      storyId: string;
      scenes: unknown[];
      initialChapterId: string | null;
      onReorderConfirm: (chapterId: string, order: { id: string; newIndex: number }[]) => void;
    }) => (
      <>
        <Text testID="scene-reorder">
          {JSON.stringify({
            isVisible,
            storyId,
            scenes: scenes.length,
            initialChapterId,
          })}
        </Text>
        <Text testID="scene-reorder-close" onPress={onClose}>
          close
        </Text>
        <Text
          testID="scene-reorder-confirm"
          onPress={() => onReorderConfirm(initialChapterId as string, [{ id: 's-1', newIndex: 0 }])}
        >
          confirm
        </Text>
      </>
    ),
  };
});

import NarrativeElementsListScreen from '../../../../src/screens/narrative-elements/chapters/NarrativeElementsListScreen';

function jsonOf(view: RenderResult, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

function rowNames(view: RenderResult): string[] {
  return view.queryAllByTestId(/^rowname-/).map((el) => el.props.children as string);
}

const t1 = new Date('2026-01-01T00:00:00.000Z');
const t2 = new Date('2026-02-01T00:00:00.000Z');

function makeChapter(id: string, overrides = {}) {
  return {
    id,
    storyId: 'story-1',
    name: id === 'ch-1' ? 'Arrival' : 'Later',
    index: id === 'ch-1' ? 0 : 1,
    type: 'chapter',
    summary: null,
    extraNotes: null,
    arcId: null,
    isFavorite: id === 'ch-2',
    createdAt: id === 'ch-1' ? t1 : t2,
    updatedAt: id === 'ch-1' ? t1 : t2,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeScene(id: string, chapterId: string | null, overrides = {}) {
  return {
    id,
    storyId: 'story-1',
    chapterId,
    locationId: null,
    name: id === 'scene-1' ? 'Harbor Dawn' : 'Mountain Pass',
    index: 0,
    summary: id === 'scene-1' ? 'Ships arrive' : 'Cold climb',
    gap: null,
    gapType: null,
    calendarDateOverride: null,
    calendarDateOverrideCalendarId: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    extraNotes: null,
    createdAt: t1,
    updatedAt: t1,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function mockServicesLoaded() {
  mockGetAllChapters.mockResolvedValue([makeChapter('ch-1'), makeChapter('ch-2')]);
  mockGetAllScenes.mockResolvedValue([makeScene('scene-1', 'ch-1'), makeScene('scene-2', 'ch-2')]);
  mockGetAllChoices.mockResolvedValue([
    {
      id: 'choice-1',
      storyId: 'story-1',
      sceneId: 'scene-1',
      nextSceneId: 'scene-2',
      text: 'Sail at secret dawn',
      notes: null,
      createdAt: t1,
      updatedAt: t1,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    },
    {
      id: 'choice-gone',
      storyId: 'story-1',
      sceneId: 'scene-2',
      nextSceneId: 'scene-1',
      text: 'Gone',
      notes: null,
      createdAt: t1,
      updatedAt: t1,
      version: 1,
      isDeleted: true,
      deletedAt: t1,
    },
  ]);
  mockGetTagsByStoryId.mockResolvedValue([{ id: 'tag-1', name: 'Epic', color: 'red' }]);
  mockGetTagsForEntity.mockImplementation(async (_storyId: string, entityId: string) =>
    entityId === 'ch-1' ? [{ id: 'tag-1', name: 'Epic', color: 'red' }] : [],
  );
  mockGetChaptersByStoryId.mockResolvedValue([makeChapter('ch-1')]);
  mockGetScenesByStoryId.mockResolvedValue([makeScene('scene-1', 'ch-1')]);
  mockGetChoicesByStoryId.mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEmitterHandlers.clear();
  mockAlertButtons = [];
  mockSelectedStory = { id: 'story-1', type: 'linear' };
  mockActiveArcId = null;
  mockCanEdit = true;
  mockStoredScenes = [];
  mockLoading = false;
  mockError = null;
  mockStoryId = 'story-1';
  mockSearchQuery = '';
  mockActiveSort = 'index';
  mockSortDirection = 'asc';
  mockFavoriteFilterState = 'all';
  mockAdvancedCriteria = {};
  mockHeaderArgs = null;
  mockListProps = null;
  mockServicesLoaded();
});

describe('NarrativeElementsListScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('requests its guided tour', async () => {
    mockLoading = false;
    await render(<NarrativeElementsListScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('NarrativeElementsStack');
  });

  it('shows loading only while the outline is empty', async () => {
    mockLoading = true;
    mockGetAllChapters.mockReturnValue(new Promise(() => {}));
    const view = await render(<NarrativeElementsListScreen />);
    expect(view.getByTestId('screen-loading')).toBeTruthy();
    expect(view.queryByTestId('list-meta')).toBeNull();
  });

  it('shows an error and navigates back', async () => {
    mockError = 'boom';
    const view = await render(<NarrativeElementsListScreen />);
    expect(view.getByTestId('screen-error').props.children).toBe('boom');
    await fireEvent.press(view.getByTestId('screen-error'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders chapters with the unchaptered group and scene count', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(rowNames(view)).toEqual(['Arrival', 'Later', 'unchaptered_scenes']);
    expect(view.getByTestId('list-meta').props.children).toBe('chapter_outline_scene_count_other');
    expect(view.getByTestId('list-search').props.children).toBe(
      'chapter_outline_search_placeholder',
    );
    expect(jsonOf(view, 'list-filters')).toMatchObject({
      options: [{ label: 'Epic', value: 'tag-1', color: 'red' }],
      selected: [],
      entity: 'Chapter',
      storyId: 'story-1',
    });
    expect(mockSetSceneDbAndStoryId).toHaveBeenCalled();
    expect(mockInitializeSceneService).toHaveBeenCalled();
    expect(mockFetchStoredScenes).toHaveBeenCalled();
  });

  it('omits the unchaptered group without edit rights', async () => {
    mockCanEdit = false;
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(rowNames(view)).toEqual(['Arrival', 'Later']);
  });

  it('guides the empty story toward creation instead of an empty unchaptered group', async () => {
    mockGetAllChapters.mockResolvedValue([]);
    mockGetAllScenes.mockResolvedValue([]);
    const view = await render(<NarrativeElementsListScreen />);
    await waitFor(() => expect(mockListProps).not.toBeNull());
    await waitFor(() => expect(mockListProps?.data).toEqual([]));

    expect(view.queryByTestId(`rowname-${UNCHAPTERED_GROUP_ID}`)).toBeNull();
    expect(mockListProps?.emptyStateTitle).toBe('narrative_empty_title');
    expect(mockListProps?.emptyStateMessage).toBe('narrative_empty_message');
    expect(mockListProps?.emptyStateActions?.map((action) => action.label)).toEqual([
      'narrative_empty_create',
    ]);
    mockListProps?.emptyStateActions?.[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('ChapterForm', { chapterId: undefined });
  });

  it('renders empty without a story', async () => {
    mockStoryId = undefined;
    const view = await render(<NarrativeElementsListScreen />);
    await waitFor(() => expect(mockListProps).not.toBeNull());
    expect(mockGetAllChapters).not.toHaveBeenCalled();
    expect(mockGetTagsByStoryId).not.toHaveBeenCalled();
    expect(rowNames(view)).toEqual([]);
  });

  it('filters rows by text across chapters, scenes and choices', async () => {
    mockSearchQuery = 'harbor';
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(rowNames(view)).toEqual(['Arrival']);
  });

  it('matches chapters through choice text', async () => {
    mockSearchQuery = 'secret';
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(rowNames(view)).toEqual(['Arrival']);
  });

  it('renders no rows when nothing matches', async () => {
    mockSearchQuery = 'zzz-no-match';
    const view = await render(<NarrativeElementsListScreen />);
    await waitFor(() => expect(mockListProps).not.toBeNull());
    await waitFor(() => expect(view.queryByTestId(`rowname-ch-1`)).toBeNull());
    expect(rowNames(view)).toEqual([]);
  });

  it('filters by favorite state', async () => {
    mockFavoriteFilterState = 'favorite';
    const favorited = await render(<NarrativeElementsListScreen />);
    await favorited.findByTestId(`rowname-ch-2`);
    expect(rowNames(favorited)).toEqual(['Later']);
    mockFavoriteFilterState = 'not-favorite';
    const unfavorited = await render(<NarrativeElementsListScreen />);
    await unfavorited.findByTestId(`rowname-ch-1`);
    expect(rowNames(unfavorited)).toEqual(['Arrival']);
  });

  it('merges stored scene favorites into the outline', async () => {
    mockStoredScenes = [{ id: 'scene-1', isFavorite: true }];
    mockFavoriteFilterState = 'favorite';
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(rowNames(view)).toEqual(['Arrival', 'Later']);
  });

  it('filters rows by tag', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-2`);
    await fireEvent.press(view.getByTestId('list-filter-change'));
    await waitFor(() => expect(rowNames(view)).toEqual(['Arrival']));
    expect(jsonOf(view, 'list-filters').selected).toEqual(['tag-1']);
  });

  it('sorts rows by name in both directions', async () => {
    mockActiveSort = 'name';
    mockSortDirection = 'desc';
    const desc = await render(<NarrativeElementsListScreen />);
    await desc.findByTestId(`rowname-ch-1`);
    expect(rowNames(desc)).toEqual(['Later', 'Arrival', 'unchaptered_scenes']);
    mockSortDirection = 'asc';
    const asc = await render(<NarrativeElementsListScreen />);
    await asc.findByTestId(`rowname-ch-1`);
    expect(rowNames(asc)).toEqual(['Arrival', 'Later', 'unchaptered_scenes']);
  });

  it('sorts rows by timestamps', async () => {
    mockActiveSort = 'updatedAt';
    mockSortDirection = 'desc';
    const updated = await render(<NarrativeElementsListScreen />);
    await updated.findByTestId(`rowname-ch-1`);
    expect(rowNames(updated)).toEqual(['Later', 'Arrival', 'unchaptered_scenes']);
    mockActiveSort = 'createdAt';
    mockSortDirection = 'asc';
    const created = await render(<NarrativeElementsListScreen />);
    await created.findByTestId(`rowname-ch-1`);
    expect(rowNames(created)).toEqual(['Arrival', 'Later', 'unchaptered_scenes']);
  });

  it('counts a single scene with the singular label', async () => {
    mockGetAllScenes.mockResolvedValue([makeScene('scene-1', 'ch-1')]);
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(view.getByTestId('list-meta').props.children).toBe('chapter_outline_scene_count_one');
  });

  it('navigates to chapter details and scenes', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    await fireEvent.press(view.getByTestId(`rowview-ch-1`));
    expect(mockNavigate).toHaveBeenCalledWith('ChapterDetail', { chapterId: 'ch-1' });
    await fireEvent.press(view.getByTestId('sceneopen-scene-1'));
    expect(mockNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 'scene-1' });
  });

  it('adds scenes with and without a chapter', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    await fireEvent.press(view.getByTestId(`rowaddscene-ch-1`));
    expect(mockNavigate).toHaveBeenCalledWith('SceneForm', { chapterId: 'ch-1' });
    await fireEvent.press(view.getByTestId(`rowaddscene-${UNCHAPTERED_GROUP_ID}`));
    expect(mockNavigate).toHaveBeenCalledWith('SceneForm', { chapterId: undefined });
  });

  it('toggles chapter favorites and reloads', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    const calls = mockGetAllChapters.mock.calls.length;
    expect(view.getByTestId(`rowfav-ch-1`).props.children).toBe('fav:false');
    await fireEvent.press(view.getByTestId(`rowfav-ch-1`));
    await waitFor(() => expect(mockToggleFavorite).toHaveBeenCalledWith('ch-1', true));
    await waitFor(() => expect(mockGetAllChapters.mock.calls.length).toBeGreaterThan(calls));
  });

  it('toggles scene favorites and reloads', async () => {
    mockToggleSceneFavorite.mockResolvedValue(undefined);
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    const calls = mockGetAllChapters.mock.calls.length;
    await fireEvent.press(view.getByTestId('scenefav-scene-1'));
    await waitFor(() => expect(mockToggleSceneFavorite).toHaveBeenCalledWith('scene-1', true));
    await waitFor(() => expect(mockGetAllChapters.mock.calls.length).toBeGreaterThan(calls));
  });

  it('reorders scenes through the modal', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(jsonOf(view, 'scene-reorder')).toMatchObject({ isVisible: false });
    await fireEvent.press(view.getByTestId(`rowreorder-ch-2`));
    expect(jsonOf(view, 'scene-reorder')).toMatchObject({
      isVisible: true,
      storyId: 'story-1',
      scenes: 2,
      initialChapterId: 'ch-2',
    });
    await fireEvent.press(view.getByTestId('scene-reorder-confirm'));
    await waitFor(() =>
      expect(mockReorderScenes).toHaveBeenCalledWith('ch-2', [{ id: 's-1', newIndex: 0 }]),
    );
    expect(jsonOf(view, 'scene-reorder').isVisible).toBe(false);
    await fireEvent.press(view.getByTestId(`rowreorder-ch-1`));
    await fireEvent.press(view.getByTestId('scene-reorder-close'));
    expect(jsonOf(view, 'scene-reorder').isVisible).toBe(false);
  });

  it('reorders chapters directly with a single container kind', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(jsonOf(view, 'chapter-reorder')).toMatchObject({ isVisible: false, chapters: [] });
    const actions = mockHeaderArgs?.actions ?? [];
    await act(async () => {
      actions[2].onPress();
    });
    expect(jsonOf(view, 'chapter-reorder')).toMatchObject({
      isVisible: true,
      chapters: ['ch-1', 'ch-2'],
    });
    await fireEvent.press(view.getByTestId('chapter-reorder-confirm'));
    await waitFor(() =>
      expect(mockReorderChapters).toHaveBeenCalledWith([{ id: 'ch-1', newIndex: 0 }], 'chapter'),
    );
    expect(jsonOf(view, 'chapter-reorder').isVisible).toBe(false);
  });

  it('asks which container kind to reorder when both exist', async () => {
    mockGetAllChapters.mockResolvedValue([
      makeChapter('ch-1'),
      makeChapter('ch-2', { type: 'event', name: 'Quake' }),
    ]);
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    const actions = mockHeaderArgs?.actions ?? [];
    await act(async () => {
      actions[2].onPress();
    });
    expect(mockAlert).toHaveBeenCalledWith('chapter_reorder_which', '', expect.any(Array));
    expect(mockAlertButtons.map((button) => button.text)).toEqual(['Chapters', 'Events', 'cancel']);
    expect(jsonOf(view, 'chapter-reorder').isVisible).toBe(false);
    await act(async () => {
      mockAlertButtons[1].onPress?.();
    });
    expect(jsonOf(view, 'chapter-reorder')).toMatchObject({
      isVisible: true,
      chapters: ['ch-2'],
    });
    await fireEvent.press(view.getByTestId('chapter-reorder-close'));
    expect(jsonOf(view, 'chapter-reorder').isVisible).toBe(false);
  });

  it('reorders events directly when only events exist', async () => {
    mockGetAllChapters.mockResolvedValue([makeChapter('ch-1', { type: 'event', name: 'Quake' })]);
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    const actions = mockHeaderArgs?.actions ?? [];
    await act(async () => {
      actions[2].onPress();
    });
    expect(mockAlert).not.toHaveBeenCalled();
    expect(jsonOf(view, 'chapter-reorder')).toMatchObject({
      isVisible: true,
      chapters: ['ch-1'],
    });
  });

  it('wires header navigation actions', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    const actions = mockHeaderArgs?.actions ?? [];
    expect(mockHeaderArgs?.title).toBe('narrative_elements_title');
    expect(actions.map((action) => action.visible)).toEqual([true, true, true, true, true]);
    expect(actions[0].label).toBe('story_flow_title');
    await act(async () => {
      actions[0].onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('ChoiceView');
    await act(async () => {
      actions[1].onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('StoryTimeline');
    await act(async () => {
      actions[3].onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('ChapterForm', { chapterId: undefined });
    expect(actions[4].label).toBe('manuscript_title');
    await act(async () => {
      actions[4].onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Manuscript', {});
  });

  it('labels the map action and hides the timeline for branching stories', async () => {
    mockSelectedStory = { id: 'story-1', type: 'branching' };
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    const actions = mockHeaderArgs?.actions ?? [];
    expect(actions[0].label).toBe('story_map_title');
    expect(actions[1].visible).toBe(false);
    const scopes = jsonOf(view, 'list-filters').scopes as { prefix: string }[];
    expect(scopes.map((scope) => scope.prefix)).toEqual(['chapter', 'scene', 'choice']);
  });

  it('omits the choice scope for linear stories', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    const scopes = jsonOf(view, 'list-filters').scopes as { prefix: string }[];
    expect(scopes.map((scope) => scope.prefix)).toEqual(['chapter', 'scene']);
  });

  it('hides edit header actions without edit rights', async () => {
    mockCanEdit = false;
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect((mockHeaderArgs?.actions ?? []).map((action) => action.visible)).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
  });

  it('hides story actions without a selected story', async () => {
    mockSelectedStory = null;
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect((mockHeaderArgs?.actions ?? []).map((action) => action.visible)).toEqual([
      false,
      false,
      true,
      true,
      false,
    ]);
  });

  it('applies advanced search matches from each scope', async () => {
    mockAdvancedCriteria = { 'chapter:name': 'Arr', 'scene:name': 'Harbor', 'choice:text': 'Sail' };
    mockGetChoicesByStoryId.mockResolvedValue([{ id: 'choice-1', sceneId: 'scene-1' }]);
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(mockGetChaptersByStoryId).toHaveBeenCalledWith(
      'story-1',
      undefined,
      undefined,
      undefined,
      'all',
      { name: 'Arr' },
    );
    expect(mockGetScenesByStoryId).toHaveBeenCalledWith(
      'story-1',
      undefined,
      undefined,
      undefined,
      'all',
      { name: 'Harbor' },
    );
    expect(mockGetChoicesByStoryId).toHaveBeenCalledWith(
      'story-1',
      undefined,
      undefined,
      undefined,
      'all',
      { text: 'Sail' },
    );
    await waitFor(() => expect(rowNames(view)).toEqual(['Arrival']));
  });

  it('ignores blank advanced criteria', async () => {
    mockAdvancedCriteria = {
      'chapter:name': '',
      'scene:name': undefined,
      other: 'x',
    };
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    expect(mockGetChaptersByStoryId).not.toHaveBeenCalled();
    expect(mockGetScenesByStoryId).not.toHaveBeenCalled();
    expect(mockGetChoicesByStoryId).not.toHaveBeenCalled();
    expect(rowNames(view)).toEqual(['Arrival', 'Later', 'unchaptered_scenes']);
  });

  it('reloads the outline on entity change events', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    const calls = mockGetAllChapters.mock.calls.length;
    await act(async () => {
      emit('scene_changed', 'story-1' as never);
    });
    await waitFor(() => expect(mockGetAllChapters.mock.calls.length).toBeGreaterThan(calls));
    const afterScene = mockGetAllChapters.mock.calls.length;
    emit('scene_changed', 'story-2' as never);
    expect(mockGetAllChapters.mock.calls.length).toBe(afterScene);
    await act(async () => {
      emit('chapter_changed', 'story-1' as never);
    });
    await waitFor(() => expect(mockGetAllChapters.mock.calls.length).toBeGreaterThan(afterScene));
    await act(async () => {
      emit('choice_changed', 'story-1' as never);
    });
    await waitFor(() =>
      expect(mockGetAllChapters.mock.calls.length).toBeGreaterThan(afterScene + 1),
    );
  });

  it('reloads tags on tag change events', async () => {
    const view = await render(<NarrativeElementsListScreen />);
    await view.findByTestId(`rowname-ch-1`);
    const calls = mockGetTagsByStoryId.mock.calls.length;
    await act(async () => {
      emit('tag_changed', 'story-1' as never);
    });
    await waitFor(() => expect(mockGetTagsByStoryId.mock.calls.length).toBeGreaterThan(calls));
    const afterTag = mockGetTagsByStoryId.mock.calls.length;
    emit('tag_changed', 'story-2' as never);
    expect(mockGetTagsByStoryId.mock.calls.length).toBe(afterTag);
    await act(async () => {
      emit('tag_relation_changed', 'story-1' as never);
    });
    await waitFor(() => expect(mockGetTagsByStoryId.mock.calls.length).toBeGreaterThan(afterTag));
  });
});
