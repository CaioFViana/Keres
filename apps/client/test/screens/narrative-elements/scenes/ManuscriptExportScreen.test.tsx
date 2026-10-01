import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import type { ChapterSelect, SceneSelect } from '../../../../src/db/schema';
import type { ManuscriptExportSettings } from '../../../../src/components/features/manuscript/export/manuscriptExportSettings';
import ManuscriptExportScreen from '../../../../src/screens/narrative-elements/scenes/ManuscriptExportScreen';

const mockGoBack = jest.fn();
const mockExportManuscript = jest.fn();
const mockNotify = jest.fn();

type OptionsProps = {
  settings: ManuscriptExportSettings;
  onChange: (settings: ManuscriptExportSettings) => void;
  formats: readonly string[];
  branching: boolean;
  showLooseSwitch: boolean;
  looseCount: number;
  arcs: { id: string; title: string }[];
};
let mockOptionsProps: OptionsProps | null = null;

let mockStoryType = 'linear';
let mockStoryTitle = 'My Story';
let mockActiveArcId: string | null = null;
let mockArcs: { id: string; title: string }[] = [];
let mockLanguage = 'en';
let mockManuscriptData: {
  chapters: ChapterSelect[];
  scenes: SceneSelect[];
  choices: { id: string; sceneId: string; nextSceneId: string; text: string }[];
  loading: boolean;
} = {
  chapters: [],
  scenes: [],
  choices: [],
  loading: false,
};

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
}));

jest.mock('../../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));

jest.mock('../../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: () => undefined,
}));

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      selectedStory: { id: 'story-1', type: mockStoryType, title: mockStoryTitle, author: 'Ana' },
      activeArcId: mockActiveArcId,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../../src/hooks/useStoryArcs', () => ({
  __esModule: true,
  useStoryArcs: () => ({ arcs: mockArcs }),
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

jest.mock(
  '../../../../src/components/features/manuscript/ManuscriptExportOptions/ManuscriptExportOptions',
  () => ({
    __esModule: true,
    default: (props: unknown) => {
      mockOptionsProps = props as OptionsProps;
      return null;
    },
  }),
);

jest.mock('../../../../src/components/features/manuscript/export/manuscriptExport', () => ({
  __esModule: true,
  MANUSCRIPT_EXPORT_FORMATS: ['docx', 'pdf', 'epub', 'html', 'md', 'txt'],
  exportManuscript: (...args: unknown[]) => mockExportManuscript(...args),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      onPrimary: '#fff',
      primary: '#00f',
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

// The real container reaches the safe area and the keyboard; this one lays the same slots out flat.
jest.mock('@/src/components/common/forms/EntityFormContainer/EntityFormContainer', () => {
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: ({
      children,
      description,
      actions,
    }: {
      children?: React.ReactNode;
      description?: string;
      actions?: React.ReactNode;
    }) => (
      <View testID="form-container">
        {description ? <Text>{description}</Text> : null}
        {children}
        {actions}
      </View>
    ),
  };
});

jest.mock('../../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: ({ message }: { message: string }) => (
      <Text testID="screen-loading">{message}</Text>
    ),
  };
});

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
    choices: [] as { id: string; sceneId: string; nextSceneId: string; text: string }[],
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
    choices: [] as { id: string; sceneId: string; nextSceneId: string; text: string }[],
    loading: false,
  };
}

const twoArcs = [
  { id: 'arc-1', title: 'First Arc' },
  { id: 'arc-2', title: 'Second Arc' },
];

function branchingData() {
  return {
    chapters: [makeChapter()],
    scenes: [
      makeScene({ id: 's-a', name: 'Alpha', body: 'First.', isStart: true }),
      makeScene({ id: 's-b', name: 'Beta', index: 2, body: 'Second.' }),
      makeScene({ id: 's-c', name: 'Attic', index: 3, body: 'Unreached.' }),
    ],
    choices: [{ id: 'c-1', sceneId: 's-a', nextSceneId: 's-b', text: 'Go on' }],
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
  mockOptionsProps = null;
  mockStoryType = 'linear';
  mockStoryTitle = 'My Story';
  mockActiveArcId = null;
  mockArcs = [];
  mockLanguage = 'en';
  mockManuscriptData = linearData();
  mockExportManuscript.mockResolvedValue({ delivered: true, fileName: 'x.docx' });
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

async function renderScreen() {
  const view = await render(<ManuscriptExportScreen />);
  expect(mockOptionsProps).toBeTruthy();
  return view;
}

/** Changes the settings the way the options component would, then presses export. */
async function exportWith(
  view: Awaited<ReturnType<typeof render>>,
  change: Partial<ManuscriptExportSettings>,
) {
  const props = mockOptionsProps as OptionsProps;
  await act(async () => {
    props.onChange({ ...props.settings, ...change });
  });
  await act(async () => {
    fireEvent.press(view.getByTestId('export-confirm'));
  });
}

describe('ManuscriptExportScreen', () => {
  it('shows the loading state while data resolves', async () => {
    mockManuscriptData = { ...linearData(), loading: true };
    const view = await render(<ManuscriptExportScreen />);
    expect(view.getByTestId('screen-loading')).toBeTruthy();
  });

  it('exports a branching story as a whole gamebook, in the order asked', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await renderScreen();
    expect(mockOptionsProps).toMatchObject({ branching: true, showLooseSwitch: false });

    await exportWith(view, { includeSceneNames: true, sceneOrder: 'shuffled' });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    // Start first; the scene nothing leads to closes the book.
    expect(sceneNames(call)).toEqual(['Alpha', 'Beta', 'Attic']);
  });

  it('closes after a made file and stays open after a failure', async () => {
    const view = await renderScreen();
    mockExportManuscript.mockRejectedValueOnce(new Error('disk full'));
    await exportWith(view, {});
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('export_manuscript_failed_body', 'error'),
    );
    expect(mockGoBack).not.toHaveBeenCalled();

    await exportWith(view, {});
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
  });

  it('leaves by cancel, with the title and back control in the native header only', async () => {
    const view = await renderScreen();

    expect(view.queryByTestId('export-close')).toBeNull();
    expect(view.getByText('export_manuscript_description')).toBeTruthy();
    await fireEvent.press(view.getByTestId('export-cancel'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('compiles the scene separator and hands the style to the pipeline', async () => {
    const view = await renderScreen();

    await exportWith(view, {
      format: 'epub',
      titlePage: true,
      author: '  Ana Lima ',
      style: { sceneSeparator: 'asterisks', quotes: 'curly', fontSize: 12, pageSize: '6x9' },
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(
      call.manuscript.blocks.filter((block: { kind: string }) => block.kind === 'scene-break'),
    ).toEqual([{ kind: 'scene-break', text: '* * *' }]);
    expect(call.metadata).toEqual({ author: 'Ana Lima', language: 'en' });
    expect(call.style).toMatchObject({
      sceneSeparator: 'asterisks',
      quotes: 'curly',
      fontSize: 12,
      frontMatter: ['export_manuscript_title_page_by', 'export_manuscript_title_page_copyright'],
      placeholders: { author: 'Ana Lima' },
    });
    // EPUB has no pages: the page size never reaches the pipeline.
    expect(call.style.pageSize).toBeUndefined();
  });

  it('offers loose scenes and starts from the default settings', async () => {
    await renderScreen();

    expect(mockOptionsProps).toMatchObject({
      branching: false,
      showLooseSwitch: true,
      looseCount: 1,
      settings: { format: 'docx', preset: 'custom', author: 'Ana' },
    });
  });

  it('exports the linear manuscript with the chosen settings', async () => {
    const view = await renderScreen();

    await exportWith(view, {
      format: 'docx',
      includeSceneNames: true,
      includeLooseScenes: true,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: null,
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
    const view = await renderScreen();

    await exportWith(view, {
      format: 'md',
      includeSceneNames: true,
      includeLooseScenes: true,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: null,
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
    const view = await renderScreen();

    await exportWith(view, {
      format: 'md',
      includeSceneNames: true,
      includeLooseScenes: true,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: null,
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    expect(mockExportManuscript.mock.calls[0][0]).toMatchObject({ language: 'pt' });
  });

  it('omits scene names and loose scenes when switched off', async () => {
    const view = await renderScreen();

    await exportWith(view, {
      format: 'md',
      includeSceneNames: false,
      includeLooseScenes: false,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: null,
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
    const view = await renderScreen();

    await exportWith(view, {
      format: 'pdf',
      includeSceneNames: true,
      includeLooseScenes: true,
      resetSceneNumbers: true,
      includeIndex: true,
      arcId: null,
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(sceneNumbers(call)).toEqual([1, 2, 1]);
    expect(call.options).toEqual({ includeToc: true });
    expect(call.labels).toMatchObject({ tocHeading: 'export_manuscript_index_heading' });
  });

  it('has no loose switch in branching stories and keeps the unreachable', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await renderScreen();

    expect(mockOptionsProps).toMatchObject({ branching: true, showLooseSwitch: false });

    await exportWith(view, {
      format: 'docx',
      includeSceneNames: true,
      includeLooseScenes: false,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: null,
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(sceneNames(call)).toEqual(['Alpha', 'Beta', 'Attic']);
    expect(
      call.manuscript.blocks.find((block: { kind: string }) => block.kind === 'subtitle'),
    ).toBeUndefined();
  });

  it('names only the numbers of a branching story when scene names are off', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await renderScreen();

    await exportWith(view, { includeSceneNames: false });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(sceneNames(call)).toEqual(['', '', '']);
    expect(sceneNumbers(call)).toEqual([1, 2, 3]);
  });

  it('notifies export failures and undelivered files', async () => {
    const view = await renderScreen();
    const choices: Partial<ManuscriptExportSettings> = {
      format: 'docx',
      includeSceneNames: false,
      includeLooseScenes: false,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: null,
    };

    mockExportManuscript.mockRejectedValueOnce(new Error('disk full'));
    await exportWith(view, choices);
    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith('export_manuscript_failed_body', 'error'),
    );

    mockExportManuscript.mockResolvedValueOnce({
      delivered: false,
      fileName: 'x.docx',
      uri: '/tmp/x',
    });
    await exportWith(view, choices);
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
      const view = await renderScreen();

      await exportWith(view, {
        format: 'pdf',
        includeSceneNames: false,
        includeLooseScenes: false,
        resetSceneNumbers: false,
        includeIndex: false,
        arcId: null,
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

  it('passes the story arcs to the options', async () => {
    mockArcs = twoArcs;
    await renderScreen();

    expect(mockOptionsProps).toMatchObject({ arcs: twoArcs });
  });

  it('exports a single arc under the arc title', async () => {
    mockArcs = twoArcs;
    mockManuscriptData = twoArcData();
    const view = await renderScreen();

    await exportWith(view, {
      format: 'docx',
      includeSceneNames: true,
      includeLooseScenes: true,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: 'arc-2',
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
    const view = await renderScreen();

    await exportWith(view, {
      format: 'docx',
      includeSceneNames: true,
      includeLooseScenes: true,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: null,
    });

    // The export arc is the screen's own pick: all-arcs still ships the whole
    // story even while the reading list shows a single arc.
    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(call.storyTitle).toBe('My Story');
    expect(call.manuscript.title).toBe('My Story');
    expect(sceneNames(call)).toEqual(['Opening', 'Leaving', 'Tremor', 'Fragment']);
  });
});
