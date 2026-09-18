import {
  act,
  cleanup,
  fireEvent,
  render,
  type RenderResult,
  waitFor,
} from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAlert = jest.fn();
const mockConvertChapterType = jest.fn();
const mockSaveNoteRelation = jest.fn();
const mockDeleteNoteRelation = jest.fn();
const mockAddComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockUpdateComment = jest.fn();

const mockGetChapterById = jest.fn();
const mockGetAllChaptersByStoryId = jest.fn();
const mockGetScenesByStoryId = jest.fn();
const mockGetAllLocationsByStoryId = jest.fn();
const mockDateForScene = jest.fn();

let mockSelectedStory: { id: string; type: string; normalizeSceneTiming: boolean } | null = {
  id: 'story-1',
  type: 'linear',
  normalizeSceneTiming: false,
};
let mockCanEdit = true;
let mockArcs: { id: string; title: string }[] = [];
let mockShowSelector = false;
let mockHeaderArgs: {
  title: string;
  actions: { id: string; icon: string; label: string; onPress: () => void; visible: boolean }[];
} | null = null;
let mockSubscriptions: { event: string; listener: (...args: never[]) => unknown }[] = [];

jest.mock('@react-navigation/native', () => {
  const route = { params: { chapterId: 'ch-1' } };
  let navigation: { navigate: (...args: never[]) => void; goBack: () => void } | null = null;
  return {
    __esModule: true,
    useNavigation: () => (navigation ??= { navigate: mockNavigate, goBack: mockGoBack }),
    useRoute: () => route,
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

jest.mock('../../../../src/hooks/useEntityRefreshLifecycle', () => {
  const react = jest.requireActual('react') as typeof import('react');
  return {
    __esModule: true,
    useEntityInitialLoad: (callback: () => void) => {
      react.useEffect(() => {
        callback();
      }, [callback]);
    },
    useEntityEventSubscriptions: (
      subs: { event: string; listener: (...args: never[]) => unknown }[],
    ) => {
      mockSubscriptions = subs;
    },
  };
});

jest.mock('../../../../src/hooks/useEntityComments', () => ({
  __esModule: true,
  useEntityComments: () => ({
    commentsByField: {},
    canComment: false,
    isStoryOwner: false,
    currentUserId: null,
    addComment: mockAddComment,
    deleteComment: mockDeleteComment,
    updateComment: mockUpdateComment,
  }),
}));

jest.mock('../../../../src/hooks/useEntityRelations', () => ({
  __esModule: true,
  useEntityRelations: () => ({
    selectedTags: [{ id: 'tag-1', name: 'Tag' }],
    allNotes: [],
    noteRelations: [],
    saveNoteRelation: mockSaveNoteRelation,
    deleteNoteRelation: mockDeleteNoteRelation,
  }),
}));

jest.mock('../../../../src/hooks/useStoryArcs', () => ({
  __esModule: true,
  useStoryArcs: () => ({ arcs: mockArcs, showSelector: mockShowSelector }),
}));

jest.mock('../../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));

jest.mock('../../../../src/hooks/useStoryCalendar', () => ({
  __esModule: true,
  useStoryCalendar: () => ({ definition: { id: 'cal-1' } }),
}));

jest.mock('../../../../src/hooks/useSceneCalendarDates', () => ({
  __esModule: true,
  useSceneCalendarDates: () => ({ dateForScene: mockDateForScene }),
}));

jest.mock('../../../../src/db', () => {
  const db = {};
  return {
    __esModule: true,
    useDrizzle: () => db,
  };
});

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));

jest.mock('../../../../src/state/chapterStore', () => ({
  __esModule: true,
  useChapterStore: (selector: (state: { convertChapterType: unknown }) => unknown) =>
    selector({ convertChapterType: mockConvertChapterType }),
}));

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
      error: '#ff0000',
    },
  }),
}));

jest.mock('../../../../src/vocabulary/useStoryVocabulary', () => ({
  __esModule: true,
  useStoryVocabulary: () => ({
    term: (value: string, plural?: boolean) => (plural ? `${value}s` : value),
  }),
}));

jest.mock('../../../../src/vocabulary/useVocabularyEntityCopy', () => {
  const copies: Record<string, object> = {};
  return {
    __esModule: true,
    useVocabularyEntityCopy: (kind: string) =>
      (copies[kind] ??= {
        entity: `${kind}-entity`,
        detailsTitle: `details-${kind}`,
        notFound: `notfound-${kind}`,
        failedToLoad: `failed-${kind}`,
        loadingDetails: `loading-${kind}`,
        dataMissing: `missing-${kind}`,
        convertTo: `convert-to-${kind}`,
      }),
  };
});

jest.mock('../../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
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
    getById: mockGetChapterById,
    getAllByStoryId: mockGetAllChaptersByStoryId,
  }),
}));

jest.mock('../../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getScenesByStoryId: mockGetScenesByStoryId }),
}));

jest.mock('../../../../src/services/storymanagement/LocationService', () => ({
  __esModule: true,
  createLocationService: () => ({ getAllByStoryId: mockGetAllLocationsByStoryId }),
}));

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

jest.mock('../../../../src/components/layout/DetailContainer/DetailContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children: React.ReactNode }) => (
      <>
        <Text testID="detail-title">{title}</Text>
        {children}
      </>
    ),
  };
});

jest.mock('../../../../src/components/common/display/DetailField/DetailField', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ label, value }: { label: string; value: string }) => (
      <Text testID={`field-${label}`}>{`${label}=${value}`}</Text>
    ),
  };
});

jest.mock('../../../../src/components/common/display/TagList/TagList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ tags, emptyMessage }: { tags: { name: string }[]; emptyMessage: string }) => (
      <Text testID="tag-list">
        {JSON.stringify({ tags: tags.map((tag) => tag.name), emptyMessage })}
      </Text>
    ),
  };
});

jest.mock(
  '../../../../src/components/features/comments/CommentableDetailField/CommentableDetailField',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({ label, value }: { label: string; value: string }) => (
        <Text testID={`commentable-${label}`}>{`${label}:${value}`}</Text>
      ),
    };
  },
);

jest.mock(
  '../../../../src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({
        storyId,
        entityType,
        entityId,
      }: {
        storyId: string;
        entityType: string;
        entityId: string;
      }) => <Text testID="custom-attrs">{JSON.stringify({ storyId, entityType, entityId })}</Text>,
    };
  },
);

jest.mock('../../../../src/components/features/favorites/FavoritedByList/FavoritedByList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      storyId,
      entityId,
      entityType,
    }: {
      storyId: string;
      entityId: string;
      entityType: string;
    }) => <Text testID="favorited">{JSON.stringify({ storyId, entityId, entityType })}</Text>,
  };
});

jest.mock('../../../../src/components/features/chapters/AnchorManager/AnchorManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      storyId,
      chapterId,
      currentUserId,
      editable,
    }: {
      storyId: string;
      chapterId: string;
      currentUserId: string | null;
      editable: boolean;
    }) => (
      <Text testID="anchor-manager">
        {JSON.stringify({ storyId, chapterId, currentUserId, editable })}
      </Text>
    ),
  };
});

jest.mock(
  '../../../../src/components/features/chapters/ConvertContainerModal/ConvertContainerModal',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({
        visible,
        name,
        currentType,
        chapterNames,
        onCancel,
        onConfirm,
      }: {
        visible: boolean;
        name: string;
        currentType: string;
        chapterNames: { id: string; name: string }[];
        onCancel: () => void;
        onConfirm: (targetType: string, position?: number) => void;
      }) => (
        <>
          <Text testID="convert-modal">
            {JSON.stringify({ visible, name, currentType, chapterNames })}
          </Text>
          <Text testID="convert-cancel" onPress={onCancel}>
            cancel
          </Text>
          <Text testID="convert-confirm" onPress={() => onConfirm('event', 2)}>
            confirm
          </Text>
        </>
      ),
    };
  },
);

jest.mock('../../../../src/components/features/scenes/RelatedScenesList/RelatedScenesList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      showChapter: boolean;
      scenes: { id: string; chapterId: string | null; index: number }[];
      matchesScene: (scene: { id: string }) => boolean;
      sortScenes: (a: { id: string; index: number }, b: { id: string; index: number }) => number;
      title: string;
      noItemsMessage: string;
      getDetails: (scene: { id: string }) => { label: string; value: string }[];
    }) => (
      <Text testID="related-scenes">
        {JSON.stringify({
          showChapter: props.showChapter,
          title: props.title,
          noItemsMessage: props.noItemsMessage,
          scenes: [...props.scenes]
            .filter((scene) => props.matchesScene(scene))
            .sort(props.sortScenes)
            .map((scene) => ({ id: scene.id, details: props.getDetails(scene) })),
        })}
      </Text>
    ),
  };
});

jest.mock('../../../../src/components/features/notes/NoteManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      noteRelations,
      availableNotes,
      onSave,
      onDelete,
      editable,
      currentStoryId,
      currentEntityId,
      currentEntityType,
    }: {
      noteRelations: unknown[];
      availableNotes: unknown[];
      onSave: (r: unknown) => void;
      onDelete: (id: string) => void;
      editable: boolean;
      currentStoryId: string;
      currentEntityId: string;
      currentEntityType: string;
    }) => (
      <>
        <Text testID="note-manager">
          {JSON.stringify({
            relations: noteRelations.length,
            notes: availableNotes.length,
            editable,
            currentStoryId,
            currentEntityId,
            currentEntityType,
          })}
        </Text>
        <Text testID="note-save" onPress={() => onSave({ id: 'nr-1' })}>
          save
        </Text>
        <Text testID="note-delete" onPress={() => onDelete('nr-1')}>
          delete
        </Text>
      </>
    ),
  };
});

jest.mock('../../../../src/components/features/seealso/SeeAlsoManager/SeeAlsoManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      storyId,
      entityType,
      entityId,
      editable,
    }: {
      storyId: string;
      entityType: string;
      entityId: string;
      editable: boolean;
    }) => (
      <Text testID="seealso">{JSON.stringify({ storyId, entityType, entityId, editable })}</Text>
    ),
  };
});

jest.mock('../../../../src/components/features/mentions/EntityMetadataWithBacklinks', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      version,
      entityType,
      entityId,
    }: {
      version: number;
      entityType: string;
      entityId: string;
    }) => <Text testID="entity-metadata">{JSON.stringify({ version, entityType, entityId })}</Text>,
  };
});

jest.mock('../../../../src/components/common/controls/Button/Button', () => {
  const { Text, TouchableOpacity } = require('react-native');
  return {
    __esModule: true,
    default: ({ onPress, children }: { onPress: () => void; children: React.ReactNode }) => (
      <TouchableOpacity testID={`stub-button-${children}`} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
  };
});

import ChapterDetailScreen from '../../../../src/screens/narrative-elements/chapters/ChapterDetailScreen';

function jsonOf(view: RenderResult, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeChapter(overrides = {}) {
  return {
    id: 'ch-1',
    storyId: 'story-1',
    name: 'Arrival',
    index: 0,
    type: 'chapter',
    summary: 'They land',
    extraNotes: null,
    arcId: null,
    isFavorite: false,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeScene(id: string, overrides = {}) {
  return {
    id,
    storyId: 'story-1',
    chapterId: 'ch-1',
    locationId: null,
    name: `Scene ${id}`,
    index: 0,
    summary: null,
    gap: null,
    gapType: null,
    duration: null,
    durationType: null,
    isStart: false,
    isFinish: false,
    isFavorite: false,
    extraNotes: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function mockServicesLoaded() {
  mockGetChapterById.mockResolvedValue(makeChapter());
  mockGetScenesByStoryId.mockResolvedValue([makeScene('scene-1'), makeScene('scene-2')]);
  mockGetAllLocationsByStoryId.mockResolvedValue([{ id: 'loc-1', name: 'Harbor' }]);
  mockGetAllChaptersByStoryId.mockResolvedValue([
    makeChapter(),
    makeChapter({ id: 'ch-2', name: 'Later' }),
  ]);
  mockDateForScene.mockReturnValue(null);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectedStory = { id: 'story-1', type: 'linear', normalizeSceneTiming: false };
  mockCanEdit = true;
  mockArcs = [];
  mockShowSelector = false;
  mockHeaderArgs = null;
  mockSubscriptions = [];
  mockServicesLoaded();
});

function silenceConsole() {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  return () => {
    error.mockRestore();
    warn.mockRestore();
  };
}

describe('ChapterDetailScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('stays on loading while the chapter resolves', async () => {
    mockGetChapterById.mockReturnValue(new Promise(() => {}));
    const view = await render(<ChapterDetailScreen />);
    expect(view.getByTestId('screen-loading').props.children).toBe('loading-Chapter');
    expect(view.queryByTestId('detail-title')).toBeNull();
  });

  it('renders the chapter content with managers', async () => {
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.getByTestId('detail-title').props.children).toBe('Arrival');
    expect(jsonOf(view, 'tag-list')).toMatchObject({ tags: ['Tag'] });
    expect(view.getByTestId('commentable-summary').props.children).toBe('summary:They land');
    expect(view.getByTestId('commentable-extra_notes').props.children).toBe(
      'extra_notes:common_na',
    );
    expect(view.getByTestId('field-is_favorite').props.children).toBe('is_favorite=common_no');
    expect(jsonOf(view, 'custom-attrs')).toMatchObject({
      storyId: 'story-1',
      entityType: 'Chapter',
      entityId: 'ch-1',
    });
    expect(jsonOf(view, 'anchor-manager')).toMatchObject({
      storyId: 'story-1',
      chapterId: 'ch-1',
      editable: false,
    });
    expect(jsonOf(view, 'note-manager')).toMatchObject({
      editable: false,
      currentStoryId: 'story-1',
      currentEntityId: 'ch-1',
      currentEntityType: 'Chapter',
    });
    expect(jsonOf(view, 'seealso')).toMatchObject({
      storyId: 'story-1',
      entityType: 'Chapter',
      entityId: 'ch-1',
      editable: false,
    });
    expect(jsonOf(view, 'entity-metadata')).toMatchObject({
      version: 1,
      entityType: 'Chapter',
      entityId: 'ch-1',
    });
    await fireEvent.press(view.getByTestId('note-save'));
    expect(mockSaveNoteRelation).toHaveBeenCalledWith({ id: 'nr-1' });
    await fireEvent.press(view.getByTestId('note-delete'));
    expect(mockDeleteNoteRelation).toHaveBeenCalledWith('nr-1');
    await fireEvent.press(view.getByTestId('stub-button-go_back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders the calendar date and duration for linear stories', async () => {
    mockDateForScene.mockReturnValue({ date: 'Day 3' });
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.getByTestId('field-calendar_chapter_date').props.children).toBe(
      'calendar_chapter_date=Day 3',
    );
    expect(view.getByTestId('field-in_universe_duration')).toBeTruthy();
  });

  it('omits the calendar date without one', async () => {
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.queryByTestId('field-calendar_chapter_date')).toBeNull();
    expect(view.getByTestId('field-in_universe_duration')).toBeTruthy();
  });

  it('omits timing fields for branching stories', async () => {
    mockSelectedStory = { id: 'story-1', type: 'branching', normalizeSceneTiming: false };
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.queryByTestId('field-in_universe_duration')).toBeNull();
    expect(view.queryByTestId('field-calendar_chapter_date')).toBeNull();
  });

  it('shows the arc field when the selector is available', async () => {
    mockShowSelector = true;
    mockArcs = [{ id: 'arc-1', title: 'War' }];
    mockGetChapterById.mockResolvedValue(makeChapter({ arcId: 'arc-1' }));
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.getByTestId('field-Arc').props.children).toBe('Arc=War');
  });

  it('falls back for chapters without an arc', async () => {
    mockShowSelector = true;
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    expect(view.getByTestId('field-Arc').props.children).toBe('Arc=common_na');
  });

  it('shows an error when loading fails and navigates back', async () => {
    const restore = silenceConsole();
    mockGetChapterById.mockRejectedValue(new Error('db down'));
    const view = await render(<ChapterDetailScreen />);
    await waitFor(() =>
      expect(view.getByTestId('screen-error').props.children).toBe('failed-Chapter'),
    );
    expect(mockHeaderArgs?.title).toBe('error');
    await fireEvent.press(view.getByTestId('screen-error'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    restore();
  });

  it('shows the not-found state for a missing chapter', async () => {
    mockGetChapterById.mockResolvedValue(null);
    const view = await render(<ChapterDetailScreen />);
    await waitFor(() =>
      expect(view.getByTestId('screen-error').props.children).toBe('notfound-Chapter'),
    );
    expect(mockHeaderArgs?.title).toBe('notfound-Chapter');
  });

  it('navigates back when the chapter was deleted', async () => {
    mockGetChapterById.mockResolvedValue(makeChapter({ isDeleted: true }));
    await render(<ChapterDetailScreen />);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
  });

  it('computes related scene details with timing and locations', async () => {
    mockDateForScene.mockImplementation((scene: { id: string }) =>
      scene.id === 'scene-1' ? { date: 'Day 1' } : null,
    );
    mockGetScenesByStoryId.mockResolvedValue([
      makeScene('scene-1', {
        index: 1,
        summary: 'First',
        duration: 2,
        durationType: 'days',
        locationId: 'loc-1',
      }),
      makeScene('scene-2', { index: 0 }),
      makeScene('scene-9', { index: 2, chapterId: 'ch-2' }),
      { ...makeScene('scene-gone', { index: 3 }), isDeleted: true },
    ]);
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    const related = jsonOf(view, 'related-scenes');
    expect(related).toMatchObject({
      showChapter: false,
      title: 'scenes_in_chapter_title',
      noItemsMessage: 'no_scenes_in_chapter',
    });
    expect(related.scenes.map((scene: { id: string }) => scene.id)).toEqual(['scene-2', 'scene-1']);
    const first = related.scenes[1].details as { label: string; value: string }[];
    expect(first[0]).toMatchObject({ label: 'summary', value: 'First' });
    expect(first[1].label).toBe('in_universe_duration');
    expect(first[2]).toMatchObject({ label: 'calendar_scene_date', value: 'Day 1' });
    expect(first[3]).toMatchObject({ label: 'Location-entity', value: 'Harbor' });
    expect(related.scenes[0].details).toEqual([]);
  });

  it('opens the edit form from the header action', async () => {
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    const actions = mockHeaderArgs?.actions ?? [];
    expect(actions).toHaveLength(2);
    expect(actions[1]).toMatchObject({ icon: 'pencil-outline', label: 'edit', visible: true });
    actions[1].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('ChapterForm', { chapterId: 'ch-1' });
  });

  it('offers conversion with event copy for chapters', async () => {
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    const actions = mockHeaderArgs?.actions ?? [];
    expect(actions[0]).toMatchObject({
      icon: 'hourglass-outline',
      label: 'convert-to-Event',
      visible: true,
    });
    expect(jsonOf(view, 'convert-modal').visible).toBe(false);
    await act(async () => {
      actions[0].onPress();
    });
    await waitFor(() => expect(jsonOf(view, 'convert-modal').visible).toBe(true));
    await waitFor(() =>
      expect(jsonOf(view, 'convert-modal').chapterNames).toEqual([{ id: 'ch-2', name: 'Later' }]),
    );
    expect(mockGetAllChaptersByStoryId).toHaveBeenCalledWith('story-1', 'chapter');
    await fireEvent.press(view.getByTestId('convert-cancel'));
    expect(jsonOf(view, 'convert-modal').visible).toBe(false);
  });

  it('confirms conversion through the store', async () => {
    mockConvertChapterType.mockResolvedValue(undefined);
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    await act(async () => {
      (mockHeaderArgs?.actions ?? [])[0].onPress();
    });
    await waitFor(() => expect(jsonOf(view, 'convert-modal').visible).toBe(true));
    await fireEvent.press(view.getByTestId('convert-confirm'));
    await waitFor(() => expect(mockConvertChapterType).toHaveBeenCalledWith('ch-1', 'event', 2));
    expect(jsonOf(view, 'convert-modal').visible).toBe(false);
  });

  it('alerts when conversion fails', async () => {
    const restore = silenceConsole();
    mockConvertChapterType.mockRejectedValue(new Error('nope'));
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    await act(async () => {
      (mockHeaderArgs?.actions ?? [])[0].onPress();
    });
    await fireEvent.press(view.getByTestId('convert-confirm'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalledWith('error', 'chapter_convert_failed'));
    restore();
  });

  it('offers chapter conversion for events', async () => {
    mockGetChapterById.mockResolvedValue(makeChapter({ type: 'event' }));
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    const actions = mockHeaderArgs?.actions ?? [];
    expect(actions[0]).toMatchObject({
      icon: 'book-outline',
      label: 'convert-to-Chapter',
      visible: true,
    });
    expect(jsonOf(view, 'convert-modal')).toMatchObject({
      visible: false,
      name: 'Arrival',
      currentType: 'event',
    });
  });

  it('hides header actions without edit rights', async () => {
    mockCanEdit = false;
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    expect((mockHeaderArgs?.actions ?? []).map((action) => action.visible)).toEqual([false, false]);
  });

  it('refreshes the chapter on change events', async () => {
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    const chapterChanged = mockSubscriptions.find((sub) => sub.event === 'chapter_changed');
    mockGetChapterById.mockResolvedValue(makeChapter({ name: 'Rewritten' }));
    await act(async () => {
      await (chapterChanged?.listener as (storyId: string, chapterId: string) => Promise<void>)(
        'story-1',
        'ch-1',
      );
    });
    await waitFor(() => expect(view.getByTestId('detail-title').props.children).toBe('Rewritten'));
    await waitFor(() => expect(mockHeaderArgs?.title).toBe('Rewritten'));
  });

  it('ignores change events for other chapters', async () => {
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    const calls = mockGetChapterById.mock.calls.length;
    const chapterChanged = mockSubscriptions.find((sub) => sub.event === 'chapter_changed');
    await act(async () => {
      await (chapterChanged?.listener as (storyId: string, chapterId: string) => Promise<void>)(
        'story-1',
        'ch-9',
      );
    });
    expect(mockGetChapterById.mock.calls.length).toBe(calls);
  });

  it('navigates back when a change event reports deletion', async () => {
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    const chapterChanged = mockSubscriptions.find((sub) => sub.event === 'chapter_changed');
    mockGetChapterById.mockResolvedValue(null);
    await act(async () => {
      await (chapterChanged?.listener as (storyId: string, chapterId: string) => Promise<void>)(
        'story-1',
        'ch-1',
      );
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('reloads scenes and locations on matching change events', async () => {
    const view = await render(<ChapterDetailScreen />);
    await view.findByTestId('detail-title');
    const byEvent = (event: string) =>
      mockSubscriptions.find((sub) => sub.event === event)?.listener as (
        storyId: string,
        entityId: string,
      ) => void;
    const scenes = mockGetScenesByStoryId.mock.calls.length;
    await act(async () => {
      byEvent('scene_changed')('story-1', 'scene-1');
    });
    expect(mockGetScenesByStoryId.mock.calls.length).toBe(scenes + 1);
    byEvent('scene_changed')('story-2', 'scene-1');
    expect(mockGetScenesByStoryId.mock.calls.length).toBe(scenes + 1);
    const locations = mockGetAllLocationsByStoryId.mock.calls.length;
    await act(async () => {
      byEvent('location_changed')('story-1', 'loc-1');
    });
    expect(mockGetAllLocationsByStoryId.mock.calls.length).toBe(locations + 1);
    byEvent('location_changed')('story-2', 'loc-1');
    expect(mockGetAllLocationsByStoryId.mock.calls.length).toBe(locations + 1);
  });
});
