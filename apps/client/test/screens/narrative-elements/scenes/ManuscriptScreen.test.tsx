import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import type { HeaderAction } from '../../../../src/components/common/navigation/HeaderActions/HeaderActions';
import type { ChapterSelect, RouteSelect, RouteStepSelect, SceneSelect } from '../../../../src/db/schema';
import type { ManuscriptExportChoices } from '../../../../src/components/features/manuscript/ManuscriptExportModal/ManuscriptExportModal';
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
  onExport: (choices: ManuscriptExportChoices) => void;
  onClose: () => void;
} | null = null;

let mockHeaderTitle: string | null = null;
let mockHeaderActions: readonly HeaderAction[] | null = null;
let mockStoryType = 'linear';
let mockStoryTitle = 'My Story';
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
  useStoryStore: () => ({ selectedStory: { id: 'story-1', type: mockStoryType, title: mockStoryTitle } }),
}));

jest.mock('../../../../src/state/notificationStore', () => ({
  __esModule: true,
  useNotificationStore: () => ({ showNotification: mockNotify }),
}));

jest.mock('../../../../src/hooks/useManuscriptData', () => ({
  __esModule: true,
  useManuscriptData: () => mockManuscriptData,
}));

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
  return { __esModule: true, useTranslation: () => ({ t }) };
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
  mockStoryType = 'linear';
  mockStoryTitle = 'My Story';
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

    expect(mockHeaderTitle).toBe('manuscript_title');
    expect(view.getByText('1. Arrival')).toBeTruthy();
    expect(view.getByText('1. Opening')).toBeTruthy();
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

  it('exposes two header actions for the compact overflow', async () => {
    await render(<ManuscriptScreen />);

    expect(mockHeaderActions?.map((action) => action.id)).toEqual(['pure-read', 'export']);
  });

  it('navigates to the scene from its title and to the editor from its pencil', async () => {
    const view = await render(<ManuscriptScreen />);

    await fireEvent.press(view.getByText('1. Opening'));
    expect(mockNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 's-1' });

    await fireEvent.press(view.getByTestId('manuscript-edit-s-1'));
    expect(mockNavigate).toHaveBeenCalledWith('SceneEditor', { sceneId: 's-1' });
  });

  it('toggles pure reading with no titles, pencils or empty scenes', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');

    expect(mockHeaderActions?.find((action) => action.id === 'pure-read')).toMatchObject({
      icon: 'eye-outline',
      label: 'manuscript_pure_read',
      active: false,
    });
    await pressHeaderAction('pure-read');
    expect(mockHeaderActions?.find((action) => action.id === 'pure-read')).toMatchObject({
      icon: 'eye',
      active: true,
    });

    await waitFor(() => expect(view.queryByText('1. Opening')).toBeNull());
    expect(view.queryByTestId('manuscript-edit-s-1')).toBeNull();
    expect(view.queryByText('manuscript_no_body_yet')).toBeNull();
    expect(view.getByText('Waves. Waves again.')).toBeTruthy();
    expect(view.getByText('Lost pages.')).toBeTruthy();
    // Chapters stay: they are non-interactive reading landmarks.
    expect(view.getByText('1. Arrival')).toBeTruthy();
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

  it('switches routes in branching stories', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await render(<ManuscriptScreen />);

    expect(view.getByTestId('route-picker-value').props.children).toBe('route-1');
    expect(view.getByText('1. Alpha')).toBeTruthy();
    expect(view.getByText('2. Beta')).toBeTruthy();

    await fireEvent.press(view.getByTestId('route-option-route-2'));
    expect(view.getByText('1. Beta')).toBeTruthy();
    expect(view.queryByText('1. Alpha')).toBeNull();
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
      });
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(call.storyTitle).toBe('My Story');
    expect(call.format).toBe('docx');
    expect(sceneNames(call)).toEqual(['Opening', 'Inland', 'Fragment']);
    expect(mockNotify).toHaveBeenCalledWith(
      'export_manuscript_success:{"fileName":"x.docx"}',
      'success',
    );
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
    };

    mockExportManuscript.mockRejectedValueOnce(new Error('disk full'));
    await act(async () => {
      mockModalProps?.onExport(choices);
    });
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('export_manuscript_failed_body', 'error'),
    );

    mockExportManuscript.mockResolvedValueOnce({ delivered: false, fileName: 'x.docx', uri: '/tmp/x' });
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
});
