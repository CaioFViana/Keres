import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import { FlatList, Platform, StyleSheet, Text } from 'react-native';
import TestRenderer from 'react-test-renderer';
import type { HeaderAction } from '../../../../src/components/common/navigation/HeaderActions/HeaderActions';
import type {
  ChapterSelect,
  CommentSelect,
  RouteSelect,
  RouteStepSelect,
  SceneSelect,
} from '../../../../src/db/schema';
import type { ManuscriptExportChoices } from '../../../../src/components/features/manuscript/ManuscriptExportModal/ManuscriptExportModal';
import MarkedText from '../../../../src/components/common/display/MarkedText/MarkedText';
import ManuscriptScreen from '../../../../src/screens/narrative-elements/scenes/ManuscriptScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockExportManuscript = jest.fn();
const mockNotify = jest.fn();
const mockUseScreenTour = jest.fn();

let mockModalProps: {
  visible: boolean;
  routeName: string | null;
  showLooseSwitch: boolean;
  looseCount: number;
  arcs: { id: string; title: string }[];
  onExport: (choices: ManuscriptExportChoices) => void;
  onClose: () => void;
} | null = null;

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

jest.mock(
  '../../../../src/components/features/manuscript/ManuscriptExportModal/ManuscriptExportModal',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: (props: unknown) => {
        mockModalProps = props as typeof mockModalProps;
        return (props as { visible: boolean }).visible ? (
          <Text testID="export-modal">open</Text>
        ) : null;
      },
    };
  },
);

jest.mock('../../../../src/components/features/manuscript/export/manuscriptExport', () => ({
  __esModule: true,
  MANUSCRIPT_EXPORT_FORMATS: ['docx', 'pdf', 'md', 'txt'],
  exportManuscript: (...args: unknown[]) => mockExportManuscript(...args),
}));

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
        <Text testID="route-picker-value">{props.value ?? props.placeholder}</Text>
        {props.options.map((option) => (
          <Text
            key={option.value}
            testID={`route-option-${option.value}`}
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

function sceneNames(call: { manuscript: { blocks: { kind: string; name?: string }[] } }): string[] {
  return call.manuscript.blocks
    .filter((block) => block.kind === 'scene-heading')
    .map((block) => block.name ?? '');
}

function sceneNumbers(call: {
  manuscript: { blocks: { kind: string; number?: number }[] };
}): number[] {
  return call.manuscript.blocks
    .filter((block) => block.kind === 'scene-heading')
    .map((block) => block.number ?? 0);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHeaderTitle = null;
  mockHeaderActions = null;
  mockModalProps = null;
  mockCommentsBySceneId = {};
  mockThreadProps = null;
  mockStoryType = 'linear';
  mockStoryTitle = 'My Story';
  mockActiveArcId = null;
  mockArcs = [];
  mockLanguage = 'en';
  mockManuscriptData = linearData();
  mockExportManuscript.mockResolvedValue({ delivered: true, fileName: 'x.docx' });
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

  it('opens the export modal offering loose scenes', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');

    expect(view.queryByTestId('export-modal')).toBeNull();

    await pressHeaderAction('export');

    expect(view.getByTestId('export-modal')).toBeTruthy();
    expect(mockModalProps).toMatchObject({
      visible: true,
      routeName: null,
      showLooseSwitch: true,
      looseCount: 1,
    });
  });

  it('exports the linear manuscript with the modal choices', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');

    await act(async () => {
      mockModalProps?.onExport({
        format: 'docx',
        includeSceneNames: true,
        includeLooseScenes: true,
        resetSceneNumbers: false,
        includeIndex: false,
        arcId: null,
      });
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(call.storyTitle).toBe('My Story');
    expect(call.format).toBe('docx');
    expect(call.language).toBe('en');
    expect(sceneNames(call)).toEqual(['Opening', 'Inland', 'Fragment']);
    expect(mockNotify).toHaveBeenCalledWith(
      'export_manuscript_success:{"fileName":"x.docx"}',
      'success',
    );
  });

  it('carries choice requirements and effects into the exported manuscript', async () => {
    mockManuscriptData = {
      ...linearData(),
      choices: [{ id: 'choice-1', sceneId: 's-1', nextSceneId: 's-2', text: 'Ford the river' }],
    };
    mockLoadChoiceAnnotations.mockResolvedValueOnce(
      new Map([
        [
          'choice-1',
          {
            requirements: ['Requires all of:', '• Requires the Brass Key'],
            effects: ['Effects', '• Gain the Rusty Key'],
          },
        ],
      ]),
    );
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');

    await act(async () => {
      mockModalProps?.onExport({
        format: 'md',
        includeSceneNames: true,
        includeLooseScenes: true,
        resetSceneNumbers: false,
        includeIndex: false,
        arcId: null,
      });
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    const choice = call.manuscript.blocks.find(
      (block: { kind: string }) => block.kind === 'choice',
    );
    expect(choice).toMatchObject({
      text: 'Ford the river',
      requirements: ['Requires all of:', '• Requires the Brass Key'],
      effects: ['Effects', '• Gain the Rusty Key'],
    });
  });

  it('exports the file name in the app language', async () => {
    mockLanguage = 'pt-BR';
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');

    await act(async () => {
      mockModalProps?.onExport({
        format: 'md',
        includeSceneNames: true,
        includeLooseScenes: true,
        resetSceneNumbers: false,
        includeIndex: false,
        arcId: null,
      });
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    expect(mockExportManuscript.mock.calls[0][0]).toMatchObject({ language: 'pt' });
  });

  it('omits scene names and loose scenes when switched off', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');

    await act(async () => {
      mockModalProps?.onExport({
        format: 'md',
        includeSceneNames: false,
        includeLooseScenes: false,
        resetSceneNumbers: false,
        includeIndex: false,
        arcId: null,
      });
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(call.format).toBe('md');
    expect(sceneNames(call)).toEqual([]);
    const text = JSON.stringify(call.manuscript.blocks);
    expect(text).toContain('Waves. Waves again.');
    expect(text).not.toContain('Lost pages.');
  });

  it('restarts scene numbers per chapter and forwards the index flag', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');

    await act(async () => {
      mockModalProps?.onExport({
        format: 'pdf',
        includeSceneNames: true,
        includeLooseScenes: true,
        resetSceneNumbers: true,
        includeIndex: true,
        arcId: null,
      });
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(sceneNumbers(call)).toEqual([1, 2, 1]);
    expect(call.options).toEqual({ includeToc: true });
    expect(call.labels).toMatchObject({ tocHeading: 'export_manuscript_index_heading' });
  });

  it('exports the current route with no loose switch in branching stories', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');

    expect(mockModalProps).toMatchObject({ routeName: 'Main', showLooseSwitch: false });

    await act(async () => {
      mockModalProps?.onExport({
        format: 'docx',
        includeSceneNames: true,
        includeLooseScenes: false,
        resetSceneNumbers: false,
        includeIndex: false,
        arcId: null,
      });
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(sceneNames(call)).toEqual(['Alpha', 'Beta']);
    expect(
      call.manuscript.blocks.find((block: { kind: string }) => block.kind === 'subtitle'),
    ).toMatchObject({ text: 'Main' });
  });

  it('notifies export failures and undelivered files', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');
    const choices: ManuscriptExportChoices = {
      format: 'docx',
      includeSceneNames: false,
      includeLooseScenes: false,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: null,
    };

    mockExportManuscript.mockRejectedValueOnce(new Error('disk full'));
    await act(async () => {
      mockModalProps?.onExport(choices);
    });
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('export_manuscript_failed_body', 'error'),
    );

    mockExportManuscript.mockResolvedValueOnce({
      delivered: false,
      fileName: 'x.docx',
      uri: '/tmp/x',
    });
    await act(async () => {
      mockModalProps?.onExport(choices);
    });
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'export_story_no_share_target:{"path":"/tmp/x"}',
        'warning',
      ),
    );
  });

  it('delivers pdf as a file on web like every other format', async () => {
    const restorePlatform = jest.replaceProperty(Platform, 'OS', 'web');
    try {
      const view = await render(<ManuscriptScreen />);
      await view.findByTestId('manuscript-list');
      await pressHeaderAction('export');

      await act(async () => {
        mockModalProps?.onExport({
          format: 'pdf',
          includeSceneNames: false,
          includeLooseScenes: false,
          resetSceneNumbers: false,
          includeIndex: false,
          arcId: null,
        });
      });

      await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
      expect(mockExportManuscript.mock.calls[0][0]).toMatchObject({ format: 'pdf' });
      expect(mockNotify).toHaveBeenCalledWith(
        'export_manuscript_success:{"fileName":"x.docx"}',
        'success',
      );
    } finally {
      restorePlatform.restore();
    }
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

  it('passes the story arcs to the export modal', async () => {
    mockArcs = twoArcs;
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');

    expect(mockModalProps).toMatchObject({ arcs: twoArcs });
  });

  it('exports a single arc under the arc title', async () => {
    mockArcs = twoArcs;
    mockManuscriptData = twoArcData();
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');

    await act(async () => {
      mockModalProps?.onExport({
        format: 'docx',
        includeSceneNames: true,
        includeLooseScenes: true,
        resetSceneNumbers: false,
        includeIndex: false,
        arcId: 'arc-2',
      });
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(call.storyTitle).toBe('Second Arc');
    expect(call.manuscript.title).toBe('Second Arc');
    expect(sceneNames(call)).toEqual(['Leaving', 'Tremor', 'Fragment']);
    const text = JSON.stringify(call.manuscript.blocks);
    expect(text).toContain('Beta.');
    expect(text).toContain('Rumble.');
    expect(text).not.toContain('Alpha.');
  });

  it('exports every arc under the story title by default', async () => {
    mockArcs = twoArcs;
    mockActiveArcId = 'arc-1';
    mockManuscriptData = twoArcData();
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await pressHeaderAction('export');

    await act(async () => {
      mockModalProps?.onExport({
        format: 'docx',
        includeSceneNames: true,
        includeLooseScenes: true,
        resetSceneNumbers: false,
        includeIndex: false,
        arcId: null,
      });
    });

    // The export arc is the modal's own pick: all-arcs still ships the whole
    // story even while the reading list shows a single arc.
    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(call.storyTitle).toBe('My Story');
    expect(call.manuscript.title).toBe('My Story');
    expect(sceneNames(call)).toEqual(['Opening', 'Leaving', 'Tremor', 'Fragment']);
  });
});
