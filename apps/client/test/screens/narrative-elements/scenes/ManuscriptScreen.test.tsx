import { act, cleanup, fireEvent, render, within } from '@testing-library/react-native';
import { FlatList, StyleSheet, Text } from 'react-native';
import TestRenderer from 'react-test-renderer';
import type { HeaderAction } from '../../../../src/components/common/navigation/HeaderActions/HeaderActions';
import type {
  ChapterSelect,
  CommentSelect,
  RouteSelect,
  RouteStepSelect,
  SceneSelect,
} from '../../../../src/db/schema';
import MarkedText from '../../../../src/components/common/display/MarkedText/MarkedText';
import ManuscriptScreen from '../../../../src/screens/narrative-elements/scenes/ManuscriptScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNotify = jest.fn();
const mockUseScreenTour = jest.fn();

let mockCommentsBySceneId: Record<string, CommentSelect[]> = {};
const mockReviewAddComment = jest.fn();
let mockThreadProps: {
  visible: boolean;
  fieldLabel: string;
  comments: CommentSelect[];
  onSubmit: (input: {
    commentText: string;
    excerptText: string | null;
    criticality: number;
  }) => Promise<void>;
} | null = null;

let mockHeaderTitle: string | null = null;
let mockHeaderActions: readonly HeaderAction[] | null = null;
let mockStoryType = 'linear';
let mockNavigatorData: Record<string, unknown> = {};
let mockStoryTitle = 'My Story';
let mockActiveArcId: string | null = null;
let mockArcs: { id: string; title: string }[] = [];
let mockLanguage = 'en';
let mockManuscriptData: {
  chapters: ChapterSelect[];
  scenes: SceneSelect[];
  routes: RouteSelect[];
  choices: { id: string; sceneId: string; nextSceneId: string; text: string }[];
  stepsByRouteId: Map<string, RouteStepSelect[]>;
  loading: boolean;
} = {
  chapters: [],
  scenes: [],
  routes: [],
  choices: [],
  stepsByRouteId: new Map(),
  loading: false,
};

jest.mock('@react-navigation/native', () => {
  const route = { params: {} };
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
  useScreenHeader: (args: { title: string; actions?: readonly HeaderAction[] }) => {
    mockHeaderTitle = args.title;
    mockHeaderActions = args.actions ?? null;
  },
}));

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      selectedStory: { id: 'story-1', type: mockStoryType, title: mockStoryTitle },
      activeArcId: mockActiveArcId,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../../src/hooks/useStoryArcs', () => ({
  __esModule: true,
  useStoryArcs: () => ({
    arcs: mockArcs,
    activeArc: mockArcs.find((arc) => arc.id === mockActiveArcId) ?? null,
    activeArcId: mockActiveArcId,
    setActiveArcId: jest.fn(),
    showSelector: mockArcs.length > 1,
    reload: jest.fn(),
  }),
}));

jest.mock('../../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockNotify }),
}));

jest.mock('../../../../src/hooks/useStoryNavigatorData', () => ({
  __esModule: true,
  useStoryNavigatorData: () => mockNavigatorData,
}));

const mockLoadChoiceAnnotations = jest.fn(async () => new Map());
jest.mock('../../../../src/hooks/useManuscriptData', () => ({
  __esModule: true,
  useManuscriptData: () => ({
    ...mockManuscriptData,
    loadChoiceAnnotations: mockLoadChoiceAnnotations,
  }),
}));

jest.mock('../../../../src/hooks/useSceneBodyComments', () => ({
  __esModule: true,
  useSceneBodyComments: () => ({
    commentsBySceneId: mockCommentsBySceneId,
    canComment: true,
    isStoryOwner: true,
    currentUserId: 'user-1',
    addComment: mockReviewAddComment,
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
  }),
}));

jest.mock(
  '../../../../src/components/features/comments/CommentThreadModal/CommentThreadModal',
  () => ({
    __esModule: true,
    default: (props: unknown) => {
      mockThreadProps = props as typeof mockThreadProps;
      return null;
    },
  }),
);

// The index modal renders for real; only its surface is stubbed, since the shared
// modal needs safe-area providers the screen harness does not set up.
jest.mock('../../../../src/components/layout/ResponsiveModal/ResponsiveModal', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
      visible ? <View>{children}</View> : null,
  };
});

jest.mock('../../../../src/components/common/inputs/MultiSelectPill/MultiSelectPill', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    SingleSelectPill: (props: {
      options: { label: string; value: string }[];
      value: string | null;
      onValueChange: (value: string | null) => void;
      placeholder?: string;
    }) => (
      <>
        <Text
          testID={
            props.placeholder === 'manuscript_view' ? 'view-picker-value' : 'route-picker-value'
          }
        >
          {props.value ?? props.placeholder}
        </Text>
        {props.options.map((option) => (
          <Text
            key={option.value}
            testID={`${props.placeholder === 'manuscript_view' ? 'view' : 'route'}-option-${option.value}`}
            onPress={() => props.onValueChange(option.value)}
          >
            {option.label}
          </Text>
        ))}
      </>
    ),
  };
});

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      notification: '#fa0',
      onPrimary: '#fff',
      onPrimaryContainer: '#001',
      primary: '#00f',
      primaryContainer: '#ccf',
      surface: '#eee',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

jest.mock('react-i18next', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;
  return {
    __esModule: true,
    useTranslation: () => ({ t, i18n: { language: mockLanguage } }),
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

jest.mock('../../../../src/guides/useScreenTour', () => ({
  __esModule: true,
  useScreenTour: (...args: unknown[]) => mockUseScreenTour(...args),
}));

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeChapter(overrides: Partial<ChapterSelect> = {}): ChapterSelect {
  return {
    id: 'ch-1',
    storyId: 'story-1',
    name: 'Arrival',
    index: 1,
    rank: 'a1',
    type: 'chapter',
    summary: null,
    isFavorite: false,
    extraNotes: null,
    arcId: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function makeScene(overrides: Partial<SceneSelect> = {}): SceneSelect {
  return {
    id: 's-1',
    storyId: 'story-1',
    chapterId: 'ch-1',
    locationId: null,
    name: 'Opening',
    index: 1,
    rank: 'a1',
    summary: null,
    body: 'Waves. Waves again.',
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

function linearData() {
  return {
    chapters: [makeChapter()],
    scenes: [
      makeScene(),
      makeScene({ id: 's-2', name: 'Inland', index: 2, body: null }),
      makeScene({ id: 's-3', name: 'Fragment', index: 3, chapterId: null, body: 'Lost pages.' }),
    ],
    routes: [] as RouteSelect[],
    choices: [] as { id: string; sceneId: string; nextSceneId: string; text: string }[],
    stepsByRouteId: new Map<string, RouteStepSelect[]>(),
    loading: false,
  };
}

function twoArcData() {
  return {
    chapters: [
      makeChapter({ id: 'ch-1', name: 'Arrival', index: 1, arcId: 'arc-1' }),
      makeChapter({ id: 'ch-2', name: 'Departure', index: 2, arcId: 'arc-2' }),
      makeChapter({ id: 'ev-1', name: 'Quake', index: 1, type: 'event', arcId: 'arc-2' }),
    ],
    scenes: [
      makeScene({ id: 's-1', chapterId: 'ch-1', name: 'Opening', index: 1, body: 'Alpha.' }),
      makeScene({ id: 's-2', chapterId: 'ch-2', name: 'Leaving', index: 1, body: 'Beta.' }),
      makeScene({ id: 's-ev', chapterId: 'ev-1', name: 'Tremor', index: 1, body: 'Rumble.' }),
      makeScene({ id: 's-3', name: 'Fragment', index: 3, chapterId: null, body: 'Lost pages.' }),
    ],
    routes: [] as RouteSelect[],
    choices: [] as { id: string; sceneId: string; nextSceneId: string; text: string }[],
    stepsByRouteId: new Map<string, RouteStepSelect[]>(),
    loading: false,
  };
}

const twoArcs = [
  { id: 'arc-1', title: 'First Arc' },
  { id: 'arc-2', title: 'Second Arc' },
];

function branchingData() {
  const route = { id: 'route-1', name: 'Main' } as RouteSelect;
  const other = { id: 'route-2', name: 'Alt' } as RouteSelect;
  const step = (id: string, routeId: string, position: number, sceneId: string) =>
    ({ id, routeId, position, sceneId, isDeleted: false }) as RouteStepSelect;
  return {
    chapters: [makeChapter()],
    scenes: [
      makeScene({ id: 's-a', name: 'Alpha', body: 'First.' }),
      makeScene({ id: 's-b', name: 'Beta', index: 2, body: 'Second.' }),
    ],
    routes: [route, other],
    choices: [] as { id: string; sceneId: string; nextSceneId: string; text: string }[],
    stepsByRouteId: new Map<string, RouteStepSelect[]>([
      ['route-1', [step('step-1', 'route-1', 1, 's-a'), step('step-2', 'route-1', 2, 's-b')]],
      ['route-2', [step('step-3', 'route-2', 1, 's-b')]],
    ]),
    loading: false,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHeaderTitle = null;
  mockHeaderActions = null;
  mockCommentsBySceneId = {};
  mockThreadProps = null;
  mockStoryType = 'linear';
  mockStoryTitle = 'My Story';
  mockActiveArcId = null;
  mockArcs = [];
  mockLanguage = 'en';
  mockManuscriptData = linearData();
  mockNavigatorData = {
    loading: false,
    scenes: [
      makeScene({ id: 's-a', name: 'Alpha', isStart: true, body: 'First.' }),
      makeScene({ id: 's-b', name: 'Beta', index: 2, body: 'Second.' }),
    ],
    choices: [{ id: 'c-1', sceneId: 's-a', nextSceneId: 's-b', text: 'Go on' }],
    items: [],
    groups: [],
    checks: [],
    effects: [],
  };
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

async function pressHeaderAction(id: string) {
  const action = mockHeaderActions?.find((candidate) => candidate.id === id);
  expect(action).toBeTruthy();
  await act(async () => {
    action?.onPress();
  });
}

describe('ManuscriptScreen', () => {
  it('renders linear sections with chapters, titles and bodies', async () => {
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');

    expect(mockHeaderTitle).toBe('manuscript_title');
    expect(view.getByText('1. Arrival')).toBeTruthy();
    expect(within(view.getByTestId('manuscript-list')).getByText('1. Opening')).toBeTruthy();
    expect(view.getByText('Waves. Waves again.')).toBeTruthy();
    expect(view.getByText('2. Inland')).toBeTruthy();
    expect(view.getByText('manuscript_no_body_yet')).toBeTruthy();
    expect(view.getByText('unchaptered_scenes')).toBeTruthy();
    expect(view.getByText('Lost pages.')).toBeTruthy();
  });

  it('starts the manuscript tour on open', async () => {
    await render(<ManuscriptScreen />);

    expect(mockUseScreenTour).toHaveBeenCalledWith('Manuscript');
  });

  it('exposes mode and export header actions for the compact overflow', async () => {
    await render(<ManuscriptScreen />);

    expect(mockHeaderActions?.map((action) => action.id)).toEqual([
      'mode-read',
      'mode-review',
      'export',
    ]);
  });

  it('navigates to the scene from its title and to the editor from its pencil', async () => {
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');

    const list = within(view.getByTestId('manuscript-list'));
    await fireEvent.press(list.getByText('1. Opening'));
    expect(mockNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 's-1' });

    await fireEvent.press(view.getByTestId('manuscript-edit-s-1'));
    expect(mockNavigate).toHaveBeenCalledWith('SceneEditor', { sceneId: 's-1' });
  });

  it('opens that scene thread from its comment button, regardless of position', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');

    // Read mode shows prose only: no per-scene buttons.
    expect(view.queryByTestId('manuscript-comment-s-3')).toBeNull();

    await pressHeaderAction('mode-review');

    // The bar still addresses the first scene (the reader never moved), but the
    // trailing loose scene's button opens s-3's own thread.
    expect(view.getAllByText('1. Opening')).toHaveLength(2);
    await fireEvent.press(view.getByTestId('manuscript-comment-s-3'));

    expect(mockThreadProps).toMatchObject({
      visible: true,
      fieldLabel: '3. Fragment',
      fieldValueSnapshot: 'Lost pages.',
    });
  });

  it('switches read and review modes from the header', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');

    expect(mockHeaderActions?.find((action) => action.id === 'mode-read')).toMatchObject({
      icon: 'book',
      label: 'manuscript_mode_read',
      active: true,
    });
    expect(mockHeaderActions?.find((action) => action.id === 'mode-review')).toMatchObject({
      icon: 'chatbubbles-outline',
      label: 'manuscript_mode_review',
      active: false,
    });
    expect(view.queryByTestId('manuscript-review-tools')).toBeNull();

    await pressHeaderAction('mode-review');

    expect(mockHeaderActions?.find((action) => action.id === 'mode-review')).toMatchObject({
      icon: 'chatbubbles',
      active: true,
    });
    const tools = view.getByTestId('manuscript-review-tools');
    expect(tools).toBeTruthy();
    // The fixed bar rides below the list, never inside it.
    let ancestor = tools.parent;
    while (ancestor) {
      expect(ancestor.type).not.toBe(FlatList);
      ancestor = ancestor.parent;
    }
    // The bar addresses the first scene until the reader moves.
    expect(view.getAllByText('1. Opening')).toHaveLength(2);
    expect(view.getByText('manuscript_comments_button:{"count":0}')).toBeTruthy();
  });

  it('reads prose-only and reviews everything', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');

    expect(view.queryByText('1. Opening')).toBeNull();
    expect(view.queryByTestId('manuscript-edit-s-1')).toBeNull();
    expect(view.queryByText('manuscript_no_body_yet')).toBeNull();
    expect(view.getByText('Waves. Waves again.')).toBeTruthy();
    expect(view.getByText('Lost pages.')).toBeTruthy();
    // Chapters stay: they are non-interactive reading landmarks.
    expect(view.getByText('1. Arrival')).toBeTruthy();

    await pressHeaderAction('mode-review');

    expect(within(view.getByTestId('manuscript-list')).getByText('1. Opening')).toBeTruthy();
    expect(view.getByTestId('manuscript-edit-s-1')).toBeTruthy();
    expect(view.getByText('manuscript_no_body_yet')).toBeTruthy();
  });

  it('marks commented passages in review and taps open that scene thread', async () => {
    mockCommentsBySceneId = {
      's-1': [{ id: 'c-1', excerptText: 'Waves' } as CommentSelect],
    };
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('mode-review');

    // One mark: the anchor is the first match, as the modal's notice says.
    const hits = view.getAllByText(/^Waves$/);
    expect(hits).toHaveLength(1);
    expect(StyleSheet.flatten(hits[0].props.style).backgroundColor).toBe('#ccf');

    await fireEvent.press(hits[0]);

    expect(mockThreadProps).toMatchObject({ visible: true, fieldLabel: '1. Opening' });
    expect(mockThreadProps?.comments).toHaveLength(1);
  });

  it('addresses the bar to the current scene and posts against its body', async () => {
    mockCommentsBySceneId = {
      's-3': [{ id: 'c-3', excerptText: 'Lost' } as CommentSelect],
    };
    const view = await render(<ManuscriptScreen />);
    await fireEvent.press(view.getByTestId('manuscript-index-open'));
    await fireEvent.press(view.getByTestId('manuscript-index-scene-s-3'));
    await pressHeaderAction('mode-review');

    expect(view.getAllByText('3. Fragment')).toHaveLength(2);
    await fireEvent.press(view.getByText('manuscript_comments_button:{"count":1}'));

    expect(mockThreadProps).toMatchObject({ visible: true, fieldLabel: '3. Fragment' });

    await act(async () => {
      await mockThreadProps?.onSubmit({
        commentText: 'Tighten',
        excerptText: null,
        criticality: 1,
      });
    });
    expect(mockReviewAddComment).toHaveBeenCalledWith('s-3', {
      commentText: 'Tighten',
      excerptText: null,
      criticality: 1,
      contentSnapshot: 'Lost pages.',
    });
  });

  it('searches with a counter and cycles through matches', async () => {
    const view = await render(<ManuscriptScreen />);

    await fireEvent.changeText(view.getByTestId('manuscript-search'), 'waves');
    expect(view.getByText('manuscript_search_count:{"current":1,"total":2}')).toBeTruthy();

    await fireEvent.press(view.getByTestId('manuscript-search-next'));
    expect(view.getByText('manuscript_search_count:{"current":2,"total":2}')).toBeTruthy();

    await fireEvent.press(view.getByTestId('manuscript-search-next'));
    expect(view.getByText('manuscript_search_count:{"current":1,"total":2}')).toBeTruthy();

    await fireEvent.press(view.getByTestId('manuscript-search-prev'));
    expect(view.getByText('manuscript_search_count:{"current":2,"total":2}')).toBeTruthy();
  });

  it('reports no matches for an absent query', async () => {
    const view = await render(<ManuscriptScreen />);

    await fireEvent.changeText(view.getByTestId('manuscript-search'), 'zzz-absent');
    expect(view.getByText('manuscript_no_results')).toBeTruthy();
  });

  it('marks every search hit in scene bodies, the current one strongly', async () => {
    const view = await render(<ManuscriptScreen />);

    await fireEvent.changeText(view.getByTestId('manuscript-search'), 'waves');

    const hits = view.getAllByText(/^Waves$/);
    expect(hits).toHaveLength(2);
    expect(StyleSheet.flatten(hits[0].props.style).backgroundColor).toBe('#00f');
    expect(StyleSheet.flatten(hits[1].props.style).backgroundColor).toBe('#ccf');
  });

  it('moves the strong mark as the reader cycles matches in one section', async () => {
    const view = await render(<ManuscriptScreen />);

    await fireEvent.changeText(view.getByTestId('manuscript-search'), 'waves');
    await fireEvent.press(view.getByTestId('manuscript-search-next'));

    const hits = view.getAllByText(/^Waves$/);
    expect(hits).toHaveLength(2);
    expect(StyleSheet.flatten(hits[0].props.style).backgroundColor).toBe('#ccf');
    expect(StyleSheet.flatten(hits[1].props.style).backgroundColor).toBe('#00f');

    await fireEvent.press(view.getByTestId('manuscript-search-next'));
    const wrapped = view.getAllByText(/^Waves$/);
    expect(StyleSheet.flatten(wrapped[0].props.style).backgroundColor).toBe('#00f');
    expect(StyleSheet.flatten(wrapped[1].props.style).backgroundColor).toBe('#ccf');
  });

  it('marks the search hit in the scene title and nothing else', async () => {
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');

    await fireEvent.changeText(view.getByTestId('manuscript-search'), 'opening');

    expect(view.getByText('manuscript_search_count:{"current":1,"total":1}')).toBeTruthy();
    const marked = view.getByText('Opening');
    expect(StyleSheet.flatten(marked.props.style).backgroundColor).toBe('#00f');
    // Untouched rows keep their bare trees: titles exact, bodies whole.
    expect(view.getByText('2. Inland')).toBeTruthy();
    expect(view.getByText('Waves. Waves again.')).toBeTruthy();
    expect(view.getByText('1. Arrival')).toBeTruthy();
  });

  it('hands the scroll ref to the active title hit, and only it', async () => {
    // The RNTL host tree cannot see composite props, hence the manual renderer.
    let mounted!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      mounted = TestRenderer.create(<ManuscriptScreen />);
    });
    await act(async () => {
      mockHeaderActions?.find((action) => action.id === 'mode-review')?.onPress();
    });
    const search = mounted.root.findByProps({ testID: 'manuscript-search' });
    const activeTexts = () =>
      mounted.root
        .findAllByType(MarkedText)
        .filter((node) => node.props.activeRef !== undefined)
        .map((node) => node.props.text);

    await act(async () => {
      search.props.onChangeText('opening');
    });
    expect(activeTexts()).toEqual(['1. Opening']);

    await act(async () => {
      search.props.onChangeText('waves');
    });
    expect(activeTexts()).toEqual(['Waves. Waves again.']);

    await act(async () => {
      mounted.unmount();
    });
  });

  it('switches routes in branching stories', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');

    expect(view.getByTestId('route-picker-value').props.children).toBe('route-1');
    const list = within(view.getByTestId('manuscript-list'));
    expect(list.getByText('1. Alpha')).toBeTruthy();
    expect(list.getByText('2. Beta')).toBeTruthy();

    await fireEvent.press(view.getByTestId('route-option-route-2'));
    expect(list.getByText('1. Beta')).toBeTruthy();
    expect(list.queryByText('1. Alpha')).toBeNull();
  });

  it('offers no view switch for linear stories', async () => {
    const view = await render(<ManuscriptScreen />);

    expect(view.queryByTestId('view-picker-value')).toBeNull();
  });

  it('reads a branching story by route by default', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await render(<ManuscriptScreen />);

    expect(view.getByTestId('view-picker-value').props.children).toBe('route');
    expect(view.getByTestId('manuscript-list')).toBeTruthy();
  });

  it('explores a branching story scene by scene, like the navigator, choosing to move on', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await render(<ManuscriptScreen />);

    await fireEvent.press(view.getByTestId('view-option-explore'));

    expect(view.queryByTestId('manuscript-list')).toBeNull();
    expect(view.getByTestId('navigator-scene-title').props.children).toBe('Alpha');
    expect(view.getByText('First.')).toBeTruthy();

    await fireEvent.press(view.getByLabelText('Go on'));

    expect(view.getByTestId('navigator-scene-title').props.children).toBe('Beta');
    expect(view.getByText('Second.')).toBeTruthy();
    expect(view.getByText('navigator_no_choices')).toBeTruthy();

    await fireEvent.press(view.getByText('navigator_restart'));
    expect(view.getByText('First.')).toBeTruthy();

    await fireEvent.press(view.getByTestId('view-option-route'));
    expect(view.getByTestId('manuscript-list')).toBeTruthy();
  });

  it('opens the scene from the explorer title', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await render(<ManuscriptScreen />);
    await fireEvent.press(view.getByTestId('view-option-explore'));

    await fireEvent.press(view.getByTestId('navigator-scene-title'));

    expect(mockNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 's-a' });
  });

  it('shows an empty state without routes in branching stories', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = { ...branchingData(), routes: [], stepsByRouteId: new Map() };
    const view = await render(<ManuscriptScreen />);
    expect(view.getByText('manuscript_no_routes')).toBeTruthy();
  });

  it('shows an empty state without scenes', async () => {
    mockManuscriptData = { ...linearData(), chapters: [], scenes: [] };
    const view = await render(<ManuscriptScreen />);
    expect(view.getByText('manuscript_no_scenes')).toBeTruthy();
  });

  it('shows the loading state while data resolves', async () => {
    mockManuscriptData = { ...linearData(), loading: true };
    const view = await render(<ManuscriptScreen />);
    expect(view.getByTestId('screen-loading')).toBeTruthy();
  });

  it('opens the export screen', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');
    expect(mockNavigate).toHaveBeenCalledWith('ManuscriptExport');
  });

  it('exports a branching story whole, whatever route is being read', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await fireEvent.press(view.getByTestId('route-option-route-2'));
    await pressHeaderAction('export');
    expect(mockNavigate).toHaveBeenCalledWith('ManuscriptExport');
  });

  it('opens the index modal listing chapters, scenes and the appendix', async () => {
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');

    expect(view.queryByTestId('manuscript-index-modal')).toBeNull();
    expect(view.getByTestId('manuscript-index-open')).toBeTruthy();

    await fireEvent.press(view.getByTestId('manuscript-index-open'));

    expect(view.getByTestId('manuscript-index-modal')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-container-ch-1')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-scene-s-1')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-scene-s-2')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-loose-heading')).toBeTruthy();
    expect(view.getByText('export_manuscript_loose_heading')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-scene-s-3')).toBeTruthy();
    // No position yet: nothing highlighted.
    expect(view.getByTestId('manuscript-index-scene-s-1').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('collapses an index chapter without touching the list', async () => {
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');
    await fireEvent.press(view.getByTestId('manuscript-index-open'));

    await fireEvent.press(view.getByTestId('manuscript-index-container-ch-1'));
    expect(view.queryByTestId('manuscript-index-scene-s-1')).toBeNull();
    // The manuscript list itself still shows the scene.
    expect(within(view.getByTestId('manuscript-list')).getByText('1. Opening')).toBeTruthy();

    await fireEvent.press(view.getByTestId('manuscript-index-container-ch-1'));
    expect(view.getByTestId('manuscript-index-scene-s-1')).toBeTruthy();
  });

  it('jumps the list to the picked index scene and closes the modal', async () => {
    const scrollSpy = jest.spyOn(FlatList.prototype, 'scrollToIndex').mockImplementation(() => {});
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');
    await fireEvent.press(view.getByTestId('manuscript-index-open'));

    await fireEvent.press(view.getByTestId('manuscript-index-scene-s-3'));

    expect(view.queryByTestId('manuscript-index-modal')).toBeNull();
    expect(scrollSpy).toHaveBeenCalledWith({ index: 4, animated: true, viewPosition: 0.1 });
  });

  it('shows comment counts per scene and chapter aggregates in the index', async () => {
    mockCommentsBySceneId = {
      's-1': [
        { id: 'c-1', excerptText: 'Waves' } as CommentSelect,
        { id: 'c-2', excerptText: null } as CommentSelect,
      ],
      's-3': [{ id: 'c-3', excerptText: 'Lost' } as CommentSelect],
    };
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');
    await fireEvent.press(view.getByTestId('manuscript-index-open'));

    const badgeText = (testID: string) =>
      within(view.getByTestId(testID)).getByText(/^[0-9]+$/).props.children;
    expect(badgeText('manuscript-index-scene-s-1-comments')).toBe(2);
    expect(badgeText('manuscript-index-container-ch-1-comments')).toBe(2);
    expect(badgeText('manuscript-index-loose-heading-comments')).toBe(1);
    expect(view.queryByTestId('manuscript-index-scene-s-2-comments')).toBeNull();
  });

  it('highlights the search match position when the index reopens', async () => {
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');

    await fireEvent.changeText(view.getByTestId('manuscript-search'), 'waves');
    await fireEvent.press(view.getByTestId('manuscript-search-next'));
    await fireEvent.press(view.getByTestId('manuscript-index-open'));

    expect(view.getByTestId('manuscript-index-scene-s-1').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(view.getByTestId('manuscript-index-scene-s-2').props.accessibilityState).toMatchObject({
      selected: false,
    });
  });

  it('lists route scenes flat in the index for branching stories', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await render(<ManuscriptScreen />);

    await fireEvent.press(view.getByTestId('manuscript-index-open'));

    expect(view.getByTestId('manuscript-index-step-step-1')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-step-step-2')).toBeTruthy();
    expect(view.queryByText('export_manuscript_loose_heading')).toBeNull();

    await fireEvent.press(view.getByTestId('manuscript-index-close'));
    expect(view.queryByTestId('manuscript-index-modal')).toBeNull();
  });

  it('shows every arc without an active arc', async () => {
    mockArcs = twoArcs;
    mockManuscriptData = twoArcData();
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');

    expect(view.getByText('1. Arrival')).toBeTruthy();
    expect(view.getByText('2. Departure')).toBeTruthy();
    expect(view.getByText('Quake')).toBeTruthy();
    expect(view.getByText('Beta.')).toBeTruthy();
    expect(view.getByText('Rumble.')).toBeTruthy();
  });

  it('hides other-arc chapters and scenes when an arc is active', async () => {
    mockArcs = twoArcs;
    mockActiveArcId = 'arc-1';
    mockManuscriptData = twoArcData();
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');

    expect(view.getByText('1. Arrival')).toBeTruthy();
    expect(within(view.getByTestId('manuscript-list')).getByText('1. Opening')).toBeTruthy();
    expect(view.getByText('Alpha.')).toBeTruthy();
    // Unchaptered scenes stay visible under any arc.
    expect(view.getByText('unchaptered_scenes')).toBeTruthy();
    expect(view.getByText('Lost pages.')).toBeTruthy();
    expect(view.queryByText('2. Departure')).toBeNull();
    expect(view.queryByText('Beta.')).toBeNull();
    // Event containers of the other arc hide with their scenes.
    expect(view.queryByText('Quake')).toBeNull();
    expect(view.queryByText('Rumble.')).toBeNull();
  });

  it('keeps the viewability callback identical across arc switches and mode toggles', async () => {
    // Web FlatList throws when this prop identity changes between renders; the
    // RNTL host tree cannot see composite props, hence the manual renderer.
    mockArcs = twoArcs;
    mockManuscriptData = twoArcData();
    let mounted!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      mounted = TestRenderer.create(<ManuscriptScreen />);
    });
    const callbackOf = () =>
      mounted.root.findByType(FlatList).props.onViewableItemsChanged as unknown;
    const first = callbackOf();

    mockActiveArcId = 'arc-1';
    await act(async () => {
      mounted.update(<ManuscriptScreen />);
    });
    expect(callbackOf()).toBe(first);

    await act(async () => {
      mockHeaderActions?.find((action) => action.id === 'mode-review')?.onPress();
    });
    expect(callbackOf()).toBe(first);

    await act(async () => {
      mounted.unmount();
    });
  });

  it('moves the review bar with the reader as scenes scroll by', async () => {
    // Tall scenes never satisfy a fraction-of-the-item rule, so the position used
    // to pin on the last short scene scrolled past; the bar follows viewability now.
    // RNTL host queries cannot see composite props, hence the manual renderer.
    mockCommentsBySceneId = {
      's-3': [{ id: 'c-3', excerptText: 'Lost' } as CommentSelect],
    };
    let mounted!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      mounted = TestRenderer.create(<ManuscriptScreen />);
    });
    await act(async () => {
      mockHeaderActions?.find((action) => action.id === 'mode-review')?.onPress();
    });
    const labels = (text: string) =>
      mounted.root.findAll((node) => node.type === Text && node.props.children === text).length;
    expect(labels('1. Opening')).toBe(2);

    const list = mounted.root.findByType(FlatList);
    expect(list.props.viewabilityConfig).toEqual({ viewAreaCoveragePercentThreshold: 20 });
    await act(async () => {
      (list.props.onViewableItemsChanged as (info: { viewableItems: { index: number }[] }) => void)(
        { viewableItems: [{ index: 4 }] },
      );
    });

    expect(labels('1. Opening')).toBe(1);
    expect(labels('3. Fragment')).toBe(2);

    await act(async () => {
      mounted.unmount();
    });
  });

  it('keeps the index modal on the same filtered sections as the list', async () => {
    mockArcs = twoArcs;
    mockActiveArcId = 'arc-1';
    mockManuscriptData = twoArcData();
    const view = await render(<ManuscriptScreen />);

    await fireEvent.press(view.getByTestId('manuscript-index-open'));

    expect(view.getByTestId('manuscript-index-container-ch-1')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-scene-s-1')).toBeTruthy();
    expect(view.getByTestId('manuscript-index-scene-s-3')).toBeTruthy();
    expect(view.queryByTestId('manuscript-index-container-ch-2')).toBeNull();
    expect(view.queryByTestId('manuscript-index-scene-s-2')).toBeNull();
    expect(view.queryByTestId('manuscript-index-container-ev-1')).toBeNull();
  });

  it('drops route steps of other-arc chapters in branching stories', async () => {
    mockStoryType = 'branching';
    mockArcs = twoArcs;
    mockActiveArcId = 'arc-1';
    const data = branchingData();
    mockManuscriptData = {
      ...data,
      chapters: [makeChapter({ arcId: 'arc-2' })],
      scenes: [
        makeScene({ id: 's-a', name: 'Alpha', body: 'First.' }),
        makeScene({ id: 's-b', name: 'Beta', index: 2, chapterId: null, body: 'Second.' }),
      ],
    };
    const view = await render(<ManuscriptScreen />);
    await pressHeaderAction('mode-review');

    expect(view.queryByText('First.')).toBeNull();
    expect(within(view.getByTestId('manuscript-list')).getByText('1. Beta')).toBeTruthy();
    expect(view.getByText('Second.')).toBeTruthy();
  });
});
