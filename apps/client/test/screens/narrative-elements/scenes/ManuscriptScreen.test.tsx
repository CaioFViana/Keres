import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import type { ChapterSelect, RouteSelect, RouteStepSelect, SceneSelect } from '../../../../src/db/schema';
import ManuscriptScreen from '../../../../src/screens/narrative-elements/scenes/ManuscriptScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockUpdateScene = jest.fn();
const mockSetText = jest.fn();
const mockSaveBody = jest.fn();
const mockExportManuscript = jest.fn();

let mockHeaderTitle: string | null = null;
let mockHeaderActions: { id: string; onPress(): void; visible: boolean }[] = [];
let mockStoryType = 'linear';
let mockStoryTitle = 'My Story';
let mockCanEdit = true;
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
let mockBodyOptionsByScene: Record<
  string,
  { savedBody: string | null; persist: (body: string | null) => Promise<void> }
> = {};

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
  useScreenHeader: (args: {
    title: string;
    actions?: { id: string; onPress(): void; visible: boolean }[];
  }) => {
    mockHeaderTitle = args.title;
    mockHeaderActions = args.actions ?? [];
  },
}));

jest.mock('../../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: mockCanEdit }),
}));

jest.mock('../../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: { id: 'story-1', type: mockStoryType, title: mockStoryTitle } }),
}));

jest.mock('../../../../src/components/features/manuscript/export/manuscriptExport', () => ({
  __esModule: true,
  exportManuscript: (...args: unknown[]) => mockExportManuscript(...args),
}));

jest.mock('../../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));

jest.mock('../../../../src/db', () => {
  const db = {};
  return { __esModule: true, useDrizzle: () => db };
});

jest.mock('../../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ updateScene: mockUpdateScene }),
}));

jest.mock('../../../../src/hooks/useManuscriptData', () => ({
  __esModule: true,
  useManuscriptData: () => mockManuscriptData,
}));

jest.mock('../../../../src/hooks/useSceneBodyDraft', () => ({
  __esModule: true,
  useSceneBodyDraft: (options: {
    sceneId: string;
    savedBody: string | null;
    persist: (body: string | null) => Promise<void>;
  }) => {
    mockBodyOptionsByScene[options.sceneId] = options;
    return {
      text: `draft-of-${options.sceneId}`,
      setText: mockSetText,
      wordCount: 2,
      charCount: 10,
      maxLength: 30000,
      isDirty: true,
      overLimit: false,
      canSave: true,
      save: mockSaveBody,
      saving: false,
      saveError: null,
      clearBodyDraft: jest.fn(),
      draftRestored: false,
    };
  },
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

jest.mock('../../../../src/components/layout/ResponsiveModal/ResponsiveModal', () => ({
  __esModule: true,
  default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? <>{children}</> : null,
}));

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

beforeEach(() => {
  jest.clearAllMocks();
  mockHeaderTitle = null;
  mockHeaderActions = [];
  mockStoryType = 'linear';
  mockStoryTitle = 'My Story';
  mockCanEdit = true;
  mockManuscriptData = linearData();
  mockBodyOptionsByScene = {};
  mockUpdateScene.mockResolvedValue(makeScene());
  mockExportManuscript.mockResolvedValue({ delivered: true, fileName: 'x.docx' });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('ManuscriptScreen', () => {
  it('renders linear sections with chapters, titles and bodies', async () => {
    const view = await render(<ManuscriptScreen />);

    expect(mockHeaderTitle).toBe('manuscript_title');
    expect(view.getByText('1. Arrival')).toBeTruthy();
    expect(view.getByText('1. Opening')).toBeTruthy();
    expect(view.getByText('Waves. Waves again.')).toBeTruthy();
    expect(view.getByText('2. Inland')).toBeTruthy();
    expect(view.getByText('manuscript_start_writing')).toBeTruthy();
    expect(view.getByText('unchaptered_scenes')).toBeTruthy();
    expect(view.getByText('Lost pages.')).toBeTruthy();
  });

  it('expands a section into the inline editor and collapses back', async () => {
    const view = await render(<ManuscriptScreen />);

    await fireEvent.press(view.getByTestId('manuscript-expand-s-1'));
    const input = await view.findByTestId('manuscript-editor-s-1.input');
    expect(input.props.value).toBe('draft-of-s-1');
    expect(mockBodyOptionsByScene['s-1'].savedBody).toBe('Waves. Waves again.');

    await fireEvent.press(view.getByText('manuscript_collapse'));
    await waitFor(() => expect(view.queryByTestId('manuscript-editor-s-1.input')).toBeNull());
    expect(view.getByText('Waves. Waves again.')).toBeTruthy();
  });

  it('persists an expanded section through the scene service', async () => {
    const view = await render(<ManuscriptScreen />);
    await fireEvent.press(view.getByTestId('manuscript-expand-s-1'));
    await view.findByTestId('manuscript-editor-s-1.input');

    await fireEvent.press(view.getByText('save'));
    expect(mockSaveBody).toHaveBeenCalledTimes(1);

    await mockBodyOptionsByScene['s-1'].persist('Edited.');
    expect(mockUpdateScene).toHaveBeenCalledWith('user-1', 's-1', { body: 'Edited.' });
  });

  it('opens the scene detail from a section title', async () => {
    const view = await render(<ManuscriptScreen />);

    await fireEvent.press(view.getByText('1. Opening'));
    expect(mockNavigate).toHaveBeenCalledWith('SceneDetail', { sceneId: 's-1' });
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

  it('exports the linear manuscript with loose scenes by default', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');

    expect(mockHeaderActions).toHaveLength(1);
    expect(mockHeaderActions[0].visible).toBe(true);
    await act(async () => {
      mockHeaderActions[0].onPress();
    });

    expect(view.getByText('export_manuscript_include_loose:{"count":1}')).toBeTruthy();
    await fireEvent.press(view.getByTestId('export-run'));

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(call.storyTitle).toBe('My Story');
    expect(call.format).toBe('docx');
    const names = call.manuscript.blocks
      .filter((block: { kind: string }) => block.kind === 'scene-heading')
      .map((block: { name: string }) => block.name);
    expect(names).toEqual(['Opening', 'Inland', 'Fragment']);
  });

  it('excludes loose scenes when the switch is off and honors the format', async () => {
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await act(async () => {
      mockHeaderActions[0].onPress();
    });

    await fireEvent(view.getByTestId('export-include-loose'), 'valueChange', false);
    await fireEvent.press(view.getByTestId('export-format-pdf'));
    await fireEvent.press(view.getByTestId('export-run'));

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    expect(call.format).toBe('pdf');
    const names = call.manuscript.blocks
      .filter((block: { kind: string }) => block.kind === 'scene-heading')
      .map((block: { name: string }) => block.name);
    expect(names).toEqual(['Opening', 'Inland']);
  });

  it('exports the current route in branching stories without the loose switch', async () => {
    mockStoryType = 'branching';
    mockManuscriptData = branchingData();
    const view = await render(<ManuscriptScreen />);
    await view.findByTestId('manuscript-list');
    await act(async () => {
      mockHeaderActions[0].onPress();
    });

    expect(view.queryByTestId('export-include-loose')).toBeNull();
    await fireEvent.press(view.getByTestId('export-run'));

    await waitFor(() => expect(mockExportManuscript).toHaveBeenCalledTimes(1));
    const call = mockExportManuscript.mock.calls[0][0];
    const names = call.manuscript.blocks
      .filter((block: { kind: string }) => block.kind === 'scene-heading')
      .map((block: { name: string }) => block.name);
    expect(names).toEqual(['Alpha', 'Beta']);
    expect(
      call.manuscript.blocks.find((block: { kind: string }) => block.kind === 'subtitle'),
    ).toMatchObject({ text: 'Main' });
  });
});
