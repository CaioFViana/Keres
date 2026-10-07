import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';
import type { ChapterSelect, LocationSelect, SceneSelect } from '../../../../src/db/schema';
import type { ManuscriptExportSettings } from '../../../../src/components/features/manuscript/export/manuscriptExportSettings';
import ManuscriptExportScreen from '../../../../src/screens/narrative-elements/scenes/ManuscriptExportScreen';

const mockGoBack = jest.fn();
const mockExportManuscript = jest.fn();
const mockDeliverScreenplay = jest.fn();
const mockNotify = jest.fn();
let mockLocations: Partial<LocationSelect>[] = [];
let mockEffectiveMedium: string | null = null;

type OptionsProps = {
  chronicle?: boolean;
  settings: ManuscriptExportSettings;
  onChange: (settings: ManuscriptExportSettings) => void;
  formats: readonly string[];
  branching: boolean;
  showLooseSwitch: boolean;
  looseCount: number;
  arcs: { id: string; title: string }[];
  screenplayEstimate?: { pages: number; eighths: number } | null;
  sizeEstimate?: { bytes: number; limit: number; status: string };
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
      effectiveArc: mockEffectiveMedium ? { id: 'arc-x', medium: mockEffectiveMedium } : null,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

jest.mock('../../../../src/db', () => ({ __esModule: true, useDrizzle: () => ({}) }));
jest.mock('../../../../src/services/storymanagement/LocationService', () => ({
  __esModule: true,
  createLocationService: () => ({ getAllByStoryId: async () => mockLocations }),
}));

const mockLoadManuscriptPages = jest.fn();
let mockPageBytes = new Map<string, number[]>();
jest.mock('../../../../src/services/storymanagement/ManuscriptPagesService', () => ({
  __esModule: true,
  loadManuscriptPages: (...args: unknown[]) => mockLoadManuscriptPages(...args),
  estimateManuscriptPageBytes: async () => mockPageBytes,
}));
let mockHasMusic = false;
let mockHasSongs = false;
const mockLoadManuscriptMusic = jest.fn();
jest.mock('../../../../src/services/storymanagement/ManuscriptMusicService', () => ({
  __esModule: true,
  loadManuscriptMusic: (...args: unknown[]) => mockLoadManuscriptMusic(...args),
  storyMusicFacts: async () => ({ hasMusic: mockHasMusic, hasSungSongs: mockHasSongs }),
  withManuscriptMusic: (scenes: unknown[], music: Map<string, unknown[]> | null) =>
    music
      ? scenes.map((scene) => {
          const list = music.get((scene as { id: string }).id);
          return list ? { ...(scene as object), music: list } : scene;
        })
      : [...scenes],
}));
jest.mock('../../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
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
  SCREENPLAY_EXPORT_FORMATS: ['fountain', 'screenplay-pdf'],
  exportManuscript: (...args: unknown[]) => mockExportManuscript(...args),
  deliverScreenplay: (...args: unknown[]) => mockDeliverScreenplay(...args),
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
  mockLocations = [];
  mockEffectiveMedium = null;
  mockManuscriptData = linearData();
  mockExportManuscript.mockResolvedValue({ delivered: true, fileName: 'x.docx' });
  mockDeliverScreenplay.mockResolvedValue({ delivered: true, fileName: 'script.fountain' });
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

describe('ManuscriptExportScreen size', () => {
  it('estimates the size from the text in scope, before anything is compiled', async () => {
    mockManuscriptData = {
      chapters: [makeChapter()],
      scenes: [makeScene({ body: 'x'.repeat(1000) })],
      choices: [],
      loading: false,
    };
    await renderScreen();

    expect(mockOptionsProps?.sizeEstimate?.status).toBe('ok');
    expect(mockOptionsProps?.sizeEstimate?.bytes).toBeGreaterThan(1000);
    expect(mockOptionsProps?.sizeEstimate?.limit).toBe(50 * 1024 * 1024);
  });

  it('counts a loose scene only when it is asked for, and a scene name only when it is shown', async () => {
    mockManuscriptData = {
      chapters: [makeChapter()],
      scenes: [
        makeScene({ id: 's-1', body: 'a'.repeat(10_000) }),
        makeScene({ id: 's-2', chapterId: null, name: 'Loose', body: 'b'.repeat(900_000) }),
      ],
      choices: [],
      loading: false,
    };
    await renderScreen();
    const without = mockOptionsProps?.sizeEstimate?.bytes ?? 0;
    const props = mockOptionsProps as OptionsProps;

    await act(async () => {
      props.onChange({ ...props.settings, format: 'md', includeLooseScenes: true });
    });
    const withLoose = (mockOptionsProps as OptionsProps).sizeEstimate?.bytes ?? 0;

    expect(withLoose).toBeGreaterThan(without + 800_000);
  });

  it('calls a very large manuscript over the limit', async () => {
    mockManuscriptData = {
      chapters: [makeChapter()],
      scenes: [makeScene({ body: 'z'.repeat(60 * 1024 * 1024) })],
      choices: [],
      loading: false,
    };
    await renderScreen();
    const props = mockOptionsProps as OptionsProps;
    await act(async () => {
      props.onChange({ ...props.settings, format: 'md' });
    });

    expect((mockOptionsProps as OptionsProps).sizeEstimate?.status).toBe('over');
  });
});

describe('ManuscriptExportScreen as a screenplay', () => {
  const asScript = () => {
    mockEffectiveMedium = 'screenplay';
    mockLocations = [{ id: 'loc-1', name: 'Kitchen', intExt: 'interior' }];
    mockManuscriptData = {
      chapters: [makeChapter({ id: 'ch-1', name: 'Act One' })],
      scenes: [
        makeScene({
          id: 's-1',
          chapterId: 'ch-1',
          locationId: 'loc-1',
          summary: 'They plan.',
          body: 'Coffee goes cold.',
        }),
      ],
      choices: [],
      loading: false,
    };
  };

  it('keeps the screenplay formats away from a work that is not a screenplay', async () => {
    await renderScreen();

    expect(mockOptionsProps?.formats).not.toContain('fountain');
    expect(mockOptionsProps?.formats).not.toContain('screenplay-pdf');
  });

  it('offers the screenplay formats for a work that is a screenplay', async () => {
    asScript();
    await renderScreen();
    expect(mockOptionsProps?.formats).toEqual(
      expect.arrayContaining(['docx', 'fountain', 'screenplay-pdf']),
    );
  });

  it('never offers them for a branching story, whose order is a graph and not a script', async () => {
    asScript();
    mockStoryType = 'branching';
    await renderScreen();

    expect(mockOptionsProps?.formats).not.toContain('fountain');
  });

  it('compiles the script from the scenes and their places, and hands it over as a screenplay', async () => {
    asScript();
    const view = await renderScreen();

    await exportWith(view, {
      format: 'fountain',
      author: 'Ana',
      screenplay: { paper: 'letter', numberScenes: true, generateHeadings: true },
    });

    await waitFor(() => expect(mockDeliverScreenplay).toHaveBeenCalledTimes(1));
    const call = mockDeliverScreenplay.mock.calls[0][0];
    const text = new TextDecoder().decode(call.bytes);
    expect(call).toMatchObject({ storyTitle: 'My Story', format: 'fountain', language: 'en' });
    expect(text).toContain('Title: My Story');
    expect(text).toContain('Author: Ana');
    expect(text).toContain('INT. KITCHEN #1#');
    expect(text).toContain('= They plan.');
    expect(text).toContain('Coffee goes cold.');
    expect(mockExportManuscript).not.toHaveBeenCalled();
    expect(mockNotify).toHaveBeenCalledWith(
      'export_manuscript_success:{"fileName":"script.fountain"}',
      'success',
    );
  });

  it('sets the PDF on the paper asked', async () => {
    asScript();
    const view = await renderScreen();

    await exportWith(view, {
      format: 'screenplay-pdf',
      screenplay: { paper: 'a4', numberScenes: false, generateHeadings: true },
    });

    await waitFor(() => expect(mockDeliverScreenplay).toHaveBeenCalledTimes(1));
    const raw = Array.from(mockDeliverScreenplay.mock.calls[0][0].bytes as Uint8Array, (byte) =>
      String.fromCharCode(byte),
    ).join('');
    expect(raw).toContain('/MediaBox [0 0 595.28 841.89]');
  });

  it('estimates the pages for a screenplay format and for no other', async () => {
    asScript();
    await renderScreen();
    const props = mockOptionsProps as OptionsProps & {
      screenplayEstimate: (settings: ManuscriptExportSettings) => unknown;
    };
    const estimate = (
      props as unknown as {
        screenplayEstimate: unknown;
      }
    ).screenplayEstimate;

    expect(estimate).toBeNull();
    await act(async () => {
      props.onChange({ ...props.settings, format: 'fountain' });
    });
    expect((mockOptionsProps as OptionsProps).screenplayEstimate).toMatchObject({
      pages: 1,
    });
  });
});

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

describe('ManuscriptExportScreen pages', () => {
  const picture = { bytes: new Uint8Array([1]), mimeType: 'image/png', width: 10, height: 20 };
  const loaded = (problems = { missing: 0, unsupported: 0, snapshot: 0 }) => ({
    pagesByScene: new Map([
      ['s-1', [{ id: 'p1', mediaId: 'g-1', fit: 'contain', text: 'Caption' }]],
    ]),
    media: { 'g-1': picture },
    problems,
  });

  it('counts the pictures of the pages in the size, in the formats that carry them', async () => {
    mockPageBytes = new Map([['s-1', [4_000_000]]]);
    const view = await renderScreen();
    await act(async () => {});
    const before = (mockOptionsProps as OptionsProps).sizeEstimate;

    expect(before?.bytes).toBeGreaterThan(4_000_000);
    mockPageBytes = new Map();
    void view;
  });

  it('reads the pages of the scenes that ship, with their pictures, and frames them as the arc asks', async () => {
    mockLoadManuscriptPages.mockResolvedValue(loaded());
    mockArcs = [{ id: 'arc-1', title: 'Issue', medium: 'storyboard', pageFormat: 'b5' }] as never;
    mockManuscriptData = twoArcData();
    const view = await renderScreen();

    await exportWith(view, {
      format: 'pdf',
      includeSceneNames: true,
      includeLooseScenes: false,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: 'arc-1',
    });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const [, userId, storyId, sceneIds, readPictures] = mockLoadManuscriptPages.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(storyId).toBe('story-1');
    expect([...(sceneIds as Set<string>)]).toEqual(['s-1']);
    expect(readPictures).toBe(true);
    const call = mockExportManuscript.mock.calls[0][0];
    expect(call.manuscript.images).toEqual({ 'g-1': picture });
    expect(call.manuscript.pageAspect).toBeCloseTo(176 / 250);
    const page = call.manuscript.blocks.find((block: { kind: string }) => block.kind === 'page');
    expect(page).toMatchObject({
      label: 'export_manuscript_frame_label 1',
      placeholder: 'export_manuscript_media_removed',
      image: { mediaId: 'g-1', fit: 'contain' },
    });
    expect(JSON.stringify(call.manuscript.blocks)).toContain('Caption');
  });

  it('reads no picture for a format that cannot show one, and still carries the text', async () => {
    mockLoadManuscriptPages.mockResolvedValue(loaded());
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
    expect(mockLoadManuscriptPages.mock.calls[0][4]).toBe(false);
    expect(mockNotify).not.toHaveBeenCalledWith(
      expect.stringContaining('pages_problems'),
      'warning',
    );
  });

  it('says how many pictures could not be included, after the file is made', async () => {
    mockLoadManuscriptPages.mockResolvedValue(loaded({ missing: 2, unsupported: 1, snapshot: 0 }));
    const view = await renderScreen();

    await exportWith(view, {
      format: 'docx',
      includeSceneNames: true,
      includeLooseScenes: true,
      resetSceneNumbers: false,
      includeIndex: false,
      arcId: null,
    });

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        'export_manuscript_pages_problems:{"count":3}',
        'warning',
      ),
    );
  });
});

describe('ManuscriptExportScreen chronicle', () => {
  it('starts a campaign from its chronicle, and offers the preset only there', async () => {
    mockEffectiveMedium = 'campaign';
    await renderScreen();

    expect(mockOptionsProps?.settings).toMatchObject({
      preset: 'chronicle',
      format: 'pdf',
      includeIndex: true,
      includeSceneNames: true,
    });
    expect(mockOptionsProps?.chronicle).toBe(true);
  });

  it('keeps every other work on the plain defaults, without the preset on offer', async () => {
    mockEffectiveMedium = 'comic';
    await renderScreen();

    expect(mockOptionsProps?.settings.preset).toBe('custom');
    expect(mockOptionsProps?.chronicle).toBe(false);
  });
});

describe('ManuscriptExportScreen page estimate', () => {
  it('counts the pages only when asked, and forgets the count once a setting changes', async () => {
    await renderScreen();
    const props = () =>
      mockOptionsProps as OptionsProps & {
        onEstimatePages?: () => void;
        pageEstimate?: { pages: number } | null;
      };

    expect(props().pageEstimate).toBeNull();
    await act(async () => props().onEstimatePages?.());
    expect(props().pageEstimate?.pages).toBeGreaterThan(0);

    await act(async () => props().onChange({ ...props().settings, includeSceneNames: true }));
    expect(props().pageEstimate).toBeNull();
  });

  it('offers no count for a branching story or for pages of a comic', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    await renderScreen();
    expect((mockOptionsProps as { onEstimatePages?: unknown }).onEstimatePages).toBeUndefined();
    await act(async () => cleanup());

    mockStoryType = 'linear';
    mockManuscriptData = linearData();
    mockEffectiveMedium = 'comic';
    await renderScreen();
    expect((mockOptionsProps as { onEstimatePages?: unknown }).onEstimatePages).toBeUndefined();
  });
});

describe('ManuscriptExportScreen music', () => {
  const theme = [{ id: 'm1', role: 'score', title: 'Theme', cue: 'at the door' }];

  beforeEach(() => {
    mockHasMusic = false;
    mockHasSongs = false;
    mockLoadManuscriptMusic.mockReset().mockResolvedValue(new Map([['s-1', theme]]));
  });

  it('offers the music when some scene has it', async () => {
    mockHasMusic = true;
    await renderScreen();
    await waitFor(() => expect((mockOptionsProps as { hasMusic?: boolean }).hasMusic).toBe(true));
  });

  it('offers no music when no scene has it', async () => {
    await renderScreen();
    await act(async () => {});
    expect((mockOptionsProps as { hasMusic?: boolean }).hasMusic).toBe(false);
  });

  it('reads no music unless the switch is on', async () => {
    mockHasMusic = true;
    const view = await renderScreen();

    await exportWith(view, { format: 'md', includeMusicCues: false });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    expect(mockLoadManuscriptMusic).not.toHaveBeenCalled();
    expect(JSON.stringify(mockExportManuscript.mock.calls[0][0].manuscript.blocks)).not.toContain(
      'Theme',
    );
  });

  it('writes the music of each scene under it in a book, in italics', async () => {
    mockHasMusic = true;
    const view = await renderScreen();

    await exportWith(view, { format: 'md', includeMusicCues: true });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const blocks = mockExportManuscript.mock.calls[0][0].manuscript.blocks as {
      kind: string;
      spans?: { text: string; italic: boolean }[];
    }[];
    const line = blocks.find((block) =>
      block.spans?.[0]?.text.startsWith('export_manuscript_music_label'),
    );
    expect(line?.spans?.[0]).toMatchObject({
      text: 'export_manuscript_music_label: Theme — at the door',
      italic: true,
    });
  });

  it('writes the music as notes in a script', async () => {
    mockHasMusic = true;
    mockEffectiveMedium = 'screenplay';
    mockManuscriptData = {
      chapters: [makeChapter({ id: 'ch-1', name: 'Act One' })],
      scenes: [makeScene({ id: 's-1', chapterId: 'ch-1', body: 'Coffee goes cold.' })],
      choices: [],
      loading: false,
    };
    const view = await renderScreen();

    await exportWith(view, { format: 'fountain', includeMusicCues: true });

    await waitFor(() => expect(mockDeliverScreenplay).toHaveBeenCalledTimes(1));
    const text = new TextDecoder().decode(mockDeliverScreenplay.mock.calls[0][0].bytes);
    expect(text).toContain('[[export_manuscript_music_label: Theme — at the door]]');
  });
});

describe('ManuscriptExportScreen songs', () => {
  const lantern = {
    id: 'song-1',
    title: 'The Lantern Song',
    lyrics: '{sov: Verse 1}\nLight the lantern\n{eov}',
    lyricsTranslation: null,
    sections: null,
  };
  const sung = [
    { id: 'm1', role: 'in-world', title: 'The Lantern Song', cue: null, song: lantern },
  ];

  beforeEach(() => {
    mockHasMusic = true;
    mockHasSongs = true;
    mockLoadManuscriptMusic.mockReset().mockResolvedValue(new Map([['s-1', sung]]));
  });

  it('offers the songs only where one is sung in the story', async () => {
    mockHasSongs = false;
    await renderScreen();
    await act(async () => {});
    expect((mockOptionsProps as { hasSongs?: boolean }).hasSongs).toBe(false);
    await act(async () => cleanup());

    mockHasSongs = true;
    await renderScreen();
    await waitFor(() => expect((mockOptionsProps as { hasSongs?: boolean }).hasSongs).toBe(true));
  });

  it('reads the words of the songs only for an export that prints them', async () => {
    const view = await renderScreen();

    await exportWith(view, { format: 'md', includeSongs: false });
    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    expect(mockLoadManuscriptMusic).not.toHaveBeenCalled();
  });

  it('prints the songs in an appendix under the heading, with their words', async () => {
    const view = await renderScreen();

    await exportWith(view, { format: 'md', includeSongs: true, songsPlacement: 'appendix' });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    expect(mockLoadManuscriptMusic.mock.calls[0][2]).toEqual({ withSongs: true });
    const blocks = mockExportManuscript.mock.calls[0][0].manuscript.blocks as {
      kind: string;
      label?: string;
      spans?: { text: string }[];
    }[];
    expect(
      blocks.some(
        (b) => b.kind === 'loose-heading' && b.label === 'export_manuscript_songs_heading',
      ),
    ).toBe(true);
    expect(JSON.stringify(blocks)).toContain('Light the lantern');
  });

  it('prints a song after the scene when asked', async () => {
    const view = await renderScreen();

    await exportWith(view, { format: 'md', includeSongs: true, songsPlacement: 'after-scene' });

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const blocks = mockExportManuscript.mock.calls[0][0].manuscript.blocks as { kind: string }[];
    expect(blocks.some((block) => block.kind === 'loose-heading')).toBe(false);
    expect(JSON.stringify(blocks)).toContain('Light the lantern');
  });

  it('writes the songs of a script as Fountain lyrics', async () => {
    mockEffectiveMedium = 'screenplay';
    mockManuscriptData = {
      chapters: [makeChapter({ id: 'ch-1', name: 'Act One' })],
      scenes: [makeScene({ id: 's-1', chapterId: 'ch-1', body: 'Coffee goes cold.' })],
      choices: [],
      loading: false,
    };
    const view = await renderScreen();

    await exportWith(view, { format: 'fountain', includeSongs: true });

    await waitFor(() => expect(mockDeliverScreenplay).toHaveBeenCalledTimes(1));
    const text = new TextDecoder().decode(mockDeliverScreenplay.mock.calls[0][0].bytes);
    expect(text).toContain('~Light the lantern');
  });
});
