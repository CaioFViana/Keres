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
const mockNavigateToDetail = jest.fn();
const mockOpenGalleryMediaViewer = jest.fn();
const mockSaveNoteRelation = jest.fn();
const mockDeleteNoteRelation = jest.fn();
const mockAddComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockUpdateComment = jest.fn();

const mockGetSceneById = jest.fn();
const mockGetPreviousNextScenes = jest.fn();
const mockGetAllScenesByStoryId = jest.fn();
const mockGetChapterById = jest.fn();
const mockGetChoicesByStoryId = jest.fn();
const mockGetRelationsForScene = jest.fn();
const mockGetLocationById = jest.fn();
const mockGetItemsByStoryId = jest.fn();
const mockGetItemJourneysBySceneId = jest.fn();
const mockGetEffectsByEntity = jest.fn();

let mockSelectedStory: { id: string; type: string } | null = {
  id: 'story-1',
  type: 'linear',
};
let mockCanEdit = true;
let mockSceneTags: unknown[] = [];
let mockHeaderArgs: {
  title: string;
  actions: { id: string; onPress: () => void; visible: boolean }[];
} | null = null;
let mockSubscriptions: { event: string; listener: (...args: never[]) => unknown }[] = [];

jest.mock('@react-navigation/native', () => {
  const route = { params: { sceneId: 'scene-1' } };
  let navigation: { navigate: (...args: never[]) => void; goBack: () => void } | null = null;
  return {
    __esModule: true,
    useNavigation: () => (navigation ??= { navigate: mockNavigate, goBack: mockGoBack }),
    useRoute: () => route,
    useFocusEffect: () => undefined,
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
    mockHeaderArgs = args;
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
    selectedTags: mockSceneTags,
    allNotes: [],
    noteRelations: [],
    saveNoteRelation: mockSaveNoteRelation,
    deleteNoteRelation: mockDeleteNoteRelation,
  }),
}));

jest.mock('../../../../src/hooks/useNavigateToEntityDetail', () => ({
  __esModule: true,
  useNavigateToEntityDetail: () => mockNavigateToDetail,
}));

jest.mock('../../../../src/hooks/useOpenGalleryMediaViewer', () => ({
  __esModule: true,
  useOpenGalleryMediaViewer: () => mockOpenGalleryMediaViewer,
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
  useSceneCalendarDates: () => ({ dateForScene: () => null }),
}));

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
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
    },
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
      }),
  };
});

jest.mock('react-i18next', () => {
  const t = (key: string) => key;
  return {
    __esModule: true,
    useTranslation: () => ({ t }),
  };
});

jest.mock('../../../../src/screens/narrative-elements/scenes/useSceneDetailServices', () => {
  let services: object | null = null;
  return {
    __esModule: true,
    useSceneDetailServices: () =>
      (services ??= {
        characters: [{ id: 'char-1', name: 'Ada' }],
        sceneServiceRef: {
          current: {
            getById: mockGetSceneById,
            getPreviousNextScenes: mockGetPreviousNextScenes,
            getAllByStoryId: mockGetAllScenesByStoryId,
          },
        },
        chapterServiceRef: { current: { getById: mockGetChapterById } },
        choiceServiceRef: { current: { getChoicesByStoryId: mockGetChoicesByStoryId } },
        characterSceneServiceRef: { current: { getRelationsForScene: mockGetRelationsForScene } },
        locationServiceRef: { current: { getById: mockGetLocationById } },
        itemServiceRef: { current: { getItemsByStoryId: mockGetItemsByStoryId } },
        itemJourneyServiceRef: {
          current: { getItemJourneysBySceneId: mockGetItemJourneysBySceneId },
        },
        effectServiceRef: { current: { getEffectsByEntity: mockGetEffectsByEntity } },
      }),
  };
});

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

jest.mock('../../../../src/screens/narrative-elements/scenes/SceneDetailContent', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    SceneDetailContent: (props: {
      scene: { id: string; name: string };
      chapter: { name: string } | null;
      location: { id: string; name: string } | null;
      previousScene?: { id: string };
      nextScene?: { id: string };
      choicesForScene: { id: string }[];
      incomingChoicesForScene: { id: string }[];
      sceneNamesById: Record<string, string>;
      isBranching: boolean;
      sceneEffects: unknown[];
      canEdit: boolean;
      sceneTags: unknown[];
      characters: { name: string }[];
      allItems: { name: string }[];
      itemJourneys: unknown[];
      sceneNoteRelations: unknown[];
      allNotes: unknown[];
      navigation: { goBack: () => void };
      handleLocationPress: () => void;
      openGalleryMediaViewer: (id: string) => void;
      saveNoteRelation: (r: unknown) => void;
      deleteNoteRelation: (id: string) => void;
      describeEffect: (effect: unknown) => string;
      t: (key: string) => string;
      manuscriptExcerpt: string | null;
      hasBodyDraft: boolean;
      onOpenEditor: () => void;
    }) => (
      <>
        <Text testID="scene-content">
          {JSON.stringify({
            scene: props.scene.name,
            chapter: props.chapter?.name ?? null,
            location: props.location?.name ?? null,
            prev: props.previousScene?.id ?? null,
            next: props.nextScene?.id ?? null,
            choices: props.choicesForScene.map((c) => c.id),
            incoming: props.incomingChoicesForScene.map((c) => c.id),
            names: props.sceneNamesById,
            isBranching: props.isBranching,
            effects: props.sceneEffects.length,
            canEdit: props.canEdit,
            tags: props.sceneTags.length,
            characters: props.characters.map((c) => c.name),
            items: props.allItems.map((i) => i.name),
            journeys: props.itemJourneys.length,
            notes: props.sceneNoteRelations.length,
            allNotes: props.allNotes.length,
            excerpt: props.manuscriptExcerpt,
            bodyDraft: props.hasBodyDraft,
          })}
        </Text>
        <Text testID="content-open-editor" onPress={props.onOpenEditor}>
          open-editor
        </Text>
        <Text testID="content-location" onPress={props.handleLocationPress}>
          location
        </Text>
        <Text testID="content-back" onPress={() => props.navigation.goBack()}>
          back
        </Text>
        <Text testID="content-gallery" onPress={() => props.openGalleryMediaViewer('g-1')}>
          gallery
        </Text>
        <Text testID="content-save-note" onPress={() => props.saveNoteRelation({ id: 'nr-1' })}>
          save-note
        </Text>
        <Text testID="content-delete-note" onPress={() => props.deleteNoteRelation('nr-1')}>
          delete-note
        </Text>
        <Text testID="content-effect">
          {props.describeEffect({ effectType: 'itemGrant', itemId: 'item-1' })}
        </Text>
      </>
    ),
  };
});

import SceneDetailScreen from '../../../../src/screens/narrative-elements/scenes/SceneDetailScreen';
import { withSilencedConsole } from '../../../helpers/silenceConsole';

function jsonOf(view: RenderResult, testID: string) {
  const el = view.getByTestId(testID);
  return JSON.parse(el.props.children as string);
}

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeScene(overrides = {}) {
  return {
    id: 'scene-1',
    storyId: 'story-1',
    chapterId: 'chapter-1',
    locationId: 'loc-1',
    name: 'Opening',
    index: 0,
    summary: 'It begins',
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
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function mockServicesLoaded() {
  mockGetSceneById.mockResolvedValue(makeScene());
  mockGetChapterById.mockResolvedValue({ id: 'chapter-1', name: 'Arrival' });
  mockGetLocationById.mockResolvedValue({ id: 'loc-1', name: 'Harbor' });
  mockGetPreviousNextScenes.mockResolvedValue({
    previousScene: { id: 'scene-0', name: 'Before' },
    nextScene: { id: 'scene-2', name: 'After' },
  });
  mockGetAllScenesByStoryId.mockResolvedValue([
    makeScene(),
    makeScene({ id: 'scene-2', name: 'After' }),
  ]);
  mockGetChoicesByStoryId.mockImplementation(
    async (
      _storyId: string,
      _a: unknown,
      _b: unknown,
      _c: unknown,
      _d: unknown,
      criteria: Record<string, string>,
    ) => {
      if (criteria?.nextSceneId) return [{ id: 'choice-in', sceneId: 'scene-0' }];
      return [{ id: 'choice-out', sceneId: 'scene-1' }];
    },
  );
  mockGetRelationsForScene.mockResolvedValue([{ id: 'rel-1' }]);
  mockGetItemsByStoryId.mockResolvedValue([{ id: 'item-1', name: 'Sword' }]);
  mockGetItemJourneysBySceneId.mockResolvedValue([{ id: 'j-1' }]);
  mockGetEffectsByEntity.mockResolvedValue([{ id: 'e-1', effectType: 'itemGrant' }]);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSelectedStory = { id: 'story-1', type: 'linear' };
  mockCanEdit = true;
  mockSceneTags = [];
  mockHeaderArgs = null;
  mockSubscriptions = [];
  mockServicesLoaded();
});

describe('SceneDetailScreen', () => {
  afterEach(() => {
    cleanup();
  });

  it('stays on loading while the scene resolves', async () => {
    mockGetSceneById.mockReturnValue(new Promise(() => {}));
    const view = await render(<SceneDetailScreen />);
    expect(view.getByTestId('screen-loading').props.children).toBe('loading-Scene');
    expect(view.queryByTestId('scene-content')).toBeNull();
  });

  it('renders content for a linear story', async () => {
    const view = await render(<SceneDetailScreen />);
    const content = await view.findByTestId('scene-content');
    expect(JSON.parse(content.props.children as string)).toMatchObject({
      scene: 'Opening',
      chapter: 'Arrival',
      location: 'Harbor',
      prev: 'scene-0',
      next: 'scene-2',
      choices: [],
      incoming: [],
      isBranching: false,
      effects: 0,
      canEdit: true,
      characters: ['Ada'],
      items: ['Sword'],
      journeys: 1,
    });
    expect(view.getByTestId('content-effect').props.children).toBe('effect_description_item_grant');
    await waitFor(() => expect(mockHeaderArgs?.title).toBe('Opening'));
    expect(mockGetPreviousNextScenes).toHaveBeenCalledWith('story-1', 'scene-1', 'chapter-1');
  });

  it('loads choices and names for branching stories', async () => {
    mockSelectedStory = { id: 'story-1', type: 'branching' };
    const view = await render(<SceneDetailScreen />);
    const content = await view.findByTestId('scene-content');
    expect(JSON.parse(content.props.children as string)).toMatchObject({
      prev: null,
      next: null,
      choices: ['choice-out'],
      incoming: ['choice-in'],
      names: { 'scene-1': 'Opening', 'scene-2': 'After' },
      isBranching: true,
      effects: 1,
    });
    expect(mockGetPreviousNextScenes).not.toHaveBeenCalled();
  });

  it('shows an error when loading fails and navigates back', async () => {
    await withSilencedConsole(['error', 'warn'], async () => {
      mockGetSceneById.mockRejectedValue(new Error('db down'));
      const view = await render(<SceneDetailScreen />);
      await waitFor(() =>
        expect(view.getByTestId('screen-error').props.children).toBe('failed-Scene'),
      );
      expect(mockHeaderArgs?.title).toBe('error');
      await fireEvent.press(view.getByTestId('screen-error'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the not-found state for a missing scene', async () => {
    mockGetSceneById.mockResolvedValue(null);
    const view = await render(<SceneDetailScreen />);
    await waitFor(() =>
      expect(view.getByTestId('screen-error').props.children).toBe('notfound-Scene'),
    );
    expect(mockHeaderArgs?.title).toBe('notfound-Scene');
  });

  it('navigates back when the scene was deleted', async () => {
    mockGetSceneById.mockResolvedValue(makeScene({ isDeleted: true }));
    await render(<SceneDetailScreen />);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
  });

  it('tolerates failing auxiliary loads', async () => {
    await withSilencedConsole(['error', 'warn'], async () => {
      mockGetChapterById.mockRejectedValue(new Error('no chapter'));
      mockGetLocationById.mockRejectedValue(new Error('no location'));
      mockGetPreviousNextScenes.mockRejectedValue(new Error('no neighbors'));
      mockGetRelationsForScene.mockRejectedValue(new Error('no relations'));
      mockGetItemsByStoryId.mockRejectedValue(new Error('no items'));
      mockGetItemJourneysBySceneId.mockRejectedValue(new Error('no journeys'));
      const view = await render(<SceneDetailScreen />);
      const content = await view.findByTestId('scene-content');
      expect(JSON.parse(content.props.children as string)).toMatchObject({
        scene: 'Opening',
        chapter: null,
        location: null,
        prev: null,
        next: null,
        items: [],
        journeys: 0,
      });
    });
  });

  it('clears chapter and location without ids', async () => {
    mockGetSceneById.mockResolvedValue(makeScene({ chapterId: null, locationId: null }));
    const view = await render(<SceneDetailScreen />);
    const content = await view.findByTestId('scene-content');
    expect(JSON.parse(content.props.children as string)).toMatchObject({
      chapter: null,
      location: null,
      prev: null,
      next: null,
    });
    expect(mockGetChapterById).not.toHaveBeenCalled();
    expect(mockGetLocationById).not.toHaveBeenCalled();
  });

  it('opens the locations detail preserving the return screen', async () => {
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    await fireEvent.press(view.getByTestId('content-location'));
    expect(mockNavigateToDetail).toHaveBeenCalledWith(
      'Location',
      'loc-1',
      expect.objectContaining({ onReturn: expect.any(Function) }),
    );
    const onReturn = mockNavigateToDetail.mock.calls[0][2].onReturn as () => void;
    onReturn();
    expect(mockNavigate).toHaveBeenCalledWith('NarrativeElementsStack', {
      screen: 'SceneDetail',
      params: { sceneId: 'scene-1' },
    });
  });

  it('ignores the location press without a location', async () => {
    mockGetSceneById.mockResolvedValue(makeScene({ locationId: null }));
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    await fireEvent.press(view.getByTestId('content-location'));
    expect(mockNavigateToDetail).not.toHaveBeenCalled();
  });

  it('wires gallery, notes and back navigation through content', async () => {
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    await fireEvent.press(view.getByTestId('content-gallery'));
    expect(mockOpenGalleryMediaViewer).toHaveBeenCalledWith('g-1');
    await fireEvent.press(view.getByTestId('content-save-note'));
    expect(mockSaveNoteRelation).toHaveBeenCalledWith({ id: 'nr-1' });
    await fireEvent.press(view.getByTestId('content-delete-note'));
    expect(mockDeleteNoteRelation).toHaveBeenCalledWith('nr-1');
    await fireEvent.press(view.getByTestId('content-back'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('opens the edit form from the header action', async () => {
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    expect(mockHeaderArgs?.actions).toHaveLength(2);
    expect(mockHeaderArgs?.actions[0].visible).toBe(true);
    mockHeaderArgs?.actions[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('SceneForm', { sceneId: 'scene-1' });
  });

  it('opens the manuscript editor from the header and the content', async () => {
    mockGetSceneById.mockResolvedValue(
      makeScene({ body: '  First line.\nSecond line with   spaces.  ' }),
    );
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');

    expect(mockHeaderArgs?.actions[1].visible).toBe(true);
    mockHeaderArgs?.actions[1].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('SceneEditor', { sceneId: 'scene-1' });

    await fireEvent.press(view.getByTestId('content-open-editor'));
    expect(mockNavigate).toHaveBeenCalledWith('SceneEditor', { sceneId: 'scene-1' });

    expect(jsonOf(view, 'scene-content')).toMatchObject({
      excerpt: 'First line. Second line with spaces.',
      bodyDraft: false,
    });
  });

  it('strips manuscript markers from the excerpt', async () => {
    mockGetSceneById.mockResolvedValue(
      makeScene({ body: '# Title\n\nA **bold**, ~~cut~~ and __lined__ line.' }),
    );
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');

    expect(jsonOf(view, 'scene-content')).toMatchObject({
      excerpt: 'Title A bold, cut and lined line.',
    });
  });

  it('hides the edit action without edit rights', async () => {
    mockCanEdit = false;
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    expect(jsonOf(view, 'scene-content').canEdit).toBe(false);
    expect(mockHeaderArgs?.actions[0].visible).toBe(false);
  });

  it('refreshes the scene on change events', async () => {
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    const sceneChanged = mockSubscriptions.find((sub) => sub.event === 'scene_changed');
    expect(sceneChanged).toBeTruthy();
    mockGetSceneById.mockResolvedValue(makeScene({ name: 'Rewritten' }));
    await act(async () => {
      await (sceneChanged?.listener as (storyId: string, sceneId: string) => Promise<void>)(
        'story-1',
        'scene-1',
      );
    });
    await waitFor(() => expect(jsonOf(view, 'scene-content').scene).toBe('Rewritten'));
    await waitFor(() => expect(mockHeaderArgs?.title).toBe('Rewritten'));
  });

  it('ignores change events for other scenes', async () => {
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    const calls = mockGetSceneById.mock.calls.length;
    const sceneChanged = mockSubscriptions.find((sub) => sub.event === 'scene_changed');
    await (sceneChanged?.listener as (storyId: string, sceneId: string) => Promise<void>)(
      'story-1',
      'scene-9',
    );
    expect(mockGetSceneById.mock.calls.length).toBe(calls);
  });

  it('navigates back when a change event reports deletion', async () => {
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    const sceneChanged = mockSubscriptions.find((sub) => sub.event === 'scene_changed');
    mockGetSceneById.mockResolvedValue(null);
    await act(async () => {
      await (sceneChanged?.listener as (storyId: string, sceneId: string) => Promise<void>)(
        'story-1',
        'scene-1',
      );
    });
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it('reloads relations on auxiliary change events', async () => {
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    const byEvent = (event: string) =>
      mockSubscriptions.find((sub) => sub.event === event)?.listener as (
        storyId: string,
        entityId: string,
      ) => void;
    const journeys = mockGetItemJourneysBySceneId.mock.calls.length;
    await act(async () => {
      byEvent('item_journey_changed')('story-1', 'j-2');
    });
    expect(mockGetItemJourneysBySceneId.mock.calls.length).toBe(journeys + 1);
    byEvent('item_journey_changed')('story-2', 'j-2');
    expect(mockGetItemJourneysBySceneId.mock.calls.length).toBe(journeys + 1);
    const items = mockGetItemsByStoryId.mock.calls.length;
    await act(async () => {
      byEvent('item_changed')('story-1', 'item-2');
    });
    expect(mockGetItemsByStoryId.mock.calls.length).toBe(items + 1);
    const relations = mockGetRelationsForScene.mock.calls.length;
    await act(async () => {
      byEvent('character_scene_changed')('story-1', 'scene-1');
    });
    expect(mockGetRelationsForScene.mock.calls.length).toBe(relations + 1);
    byEvent('character_scene_changed')('story-1', 'scene-9');
    expect(mockGetRelationsForScene.mock.calls.length).toBe(relations + 1);
  });

  it('reloads effects only for the open scene', async () => {
    mockSelectedStory = { id: 'story-1', type: 'branching' };
    const view = await render(<SceneDetailScreen />);
    await view.findByTestId('scene-content');
    const byEvent = (event: string) =>
      mockSubscriptions.find((sub) => sub.event === event)?.listener as (
        storyId: string,
        entityId: string,
      ) => void;
    const effects = mockGetEffectsByEntity.mock.calls.length;
    await act(async () => {
      byEvent('effect_changed')('story-1', 'scene-1');
    });
    expect(mockGetEffectsByEntity.mock.calls.length).toBe(effects + 1);
    byEvent('effect_changed')('story-1', 'scene-9');
    byEvent('effect_changed')('story-2', 'scene-1');
    expect(mockGetEffectsByEntity.mock.calls.length).toBe(effects + 1);
  });
});
