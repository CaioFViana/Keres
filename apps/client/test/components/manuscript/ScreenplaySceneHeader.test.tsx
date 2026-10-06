import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react-native';
import {
  ScreenplaySceneHeader,
  useScreenplaySceneContext,
} from '../../../src/components/features/manuscript/ScreenplaySceneHeader/ScreenplaySceneHeader';
import type { SceneSelect } from '../../../src/db/schema';

let mockEffectiveMedium: string | null = null;
let mockChapter: { arcId: string | null } | undefined;
let mockArc: { medium: string } | undefined;
let mockLocation: { name: string; intExt: string | null; isDeleted: boolean } | undefined;
let mockRelations: { characterId: string }[] = [];
let mockCharacters: Record<string, { name: string; isDeleted: boolean }> = {};

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({
    colors: { text: '#111', textSecondary: '#555', surface: '#fff', border: '#ddd', error: '#f00' },
  }),
}));
jest.mock('react-i18next', () => {
  const t = (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;
  return { __esModule: true, useTranslation: () => ({ t }) };
});
// The same handle every render, like the real one: a new object each time would re-run every effect.
const mockDb = {};
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDb }));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: (selector: (state: unknown) => unknown) =>
    selector({ effectiveArc: mockEffectiveMedium ? { medium: mockEffectiveMedium } : null }),
}));
jest.mock('../../../src/services/storymanagement/ChapterService', () => ({
  __esModule: true,
  createChapterService: () => ({ getById: async () => mockChapter }),
}));
jest.mock('../../../src/services/storymanagement/StoryArcService', () => ({
  __esModule: true,
  createStoryArcService: () => ({ getById: async () => mockArc }),
}));
jest.mock('../../../src/services/storymanagement/LocationService', () => ({
  __esModule: true,
  createLocationService: () => ({ getById: async () => mockLocation }),
}));
jest.mock('../../../src/services/storymanagement/CharacterSceneService', () => ({
  __esModule: true,
  createCharacterSceneService: () => ({ getRelationsForScene: async () => mockRelations }),
}));
jest.mock('../../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: () => ({ getById: async (id: string) => mockCharacters[id] }),
}));

const scene = {
  id: 'scene-1',
  storyId: 'story-1',
  chapterId: 'ch-1',
  locationId: 'loc-1',
} as SceneSelect;

beforeEach(() => {
  mockEffectiveMedium = null;
  mockChapter = { arcId: 'arc-1' };
  mockArc = { medium: 'screenplay' };
  mockLocation = { name: 'Kitchen', intExt: 'interior', isDeleted: false };
  mockRelations = [{ characterId: 'c-1' }, { characterId: 'c-2' }, { characterId: 'c-3' }];
  mockCharacters = {
    'c-1': { name: 'Mom', isDeleted: false },
    'c-2': { name: 'Sam', isDeleted: false },
    'c-3': { name: 'Gone', isDeleted: true },
  };
});

afterEach(() => cleanup());

describe('useScreenplaySceneContext', () => {
  it('knows a scene is part of a screenplay by the work of its chapter, with its place and cast', async () => {
    const { result } = await renderHook(() => useScreenplaySceneContext(scene, 'Coffee.'));

    await waitFor(() => expect(result.current.isScreenplay).toBe(true));
    await waitFor(() => expect(result.current.cast).toEqual(['Mom', 'Sam']));
    expect(result.current.place).toEqual({ name: 'Kitchen', intExt: 'interior' });
    expect(result.current.plan).toEqual({ source: 'location', heading: 'INT. KITCHEN' });
  });

  it('is not a screenplay scene when its work is not one', async () => {
    mockArc = { medium: 'comic' };
    const { result } = await renderHook(() => useScreenplaySceneContext(scene, 'Coffee.'));
    await waitFor(() => expect(result.current.place).not.toBeNull());

    expect(result.current.isScreenplay).toBe(false);
  });

  it('takes the work in effect for a scene filed in no chapter', async () => {
    mockEffectiveMedium = 'screenplay';
    const { result } = await renderHook(() =>
      useScreenplaySceneContext({ ...scene, chapterId: null }, 'Coffee.'),
    );

    await waitFor(() => expect(result.current.isScreenplay).toBe(true));
  });

  it("lets the writer's own heading win over the place, as the export does", async () => {
    const { result } = await renderHook(() =>
      useScreenplaySceneContext(scene, 'INT. CELLAR - NIGHT\n\nDark.'),
    );
    await waitFor(() => expect(result.current.place).not.toBeNull());

    expect(result.current.plan).toEqual({ source: 'body', heading: 'INT. CELLAR - NIGHT' });
  });

  it('has no heading for a scene with no place and no heading of its own', async () => {
    mockLocation = undefined;
    const { result } = await renderHook(() => useScreenplaySceneContext(scene, 'Dark.'));
    await act(async () => {});

    expect(result.current.plan).toEqual({ source: 'none', heading: null });
  });

  it('forgets a place that was removed', async () => {
    mockLocation = { name: 'Kitchen', intExt: 'interior', isDeleted: true };
    const { result } = await renderHook(() => useScreenplaySceneContext(scene, 'Dark.'));
    await act(async () => {});

    expect(result.current.place).toBeNull();
  });
});

describe('ScreenplaySceneHeader', () => {
  it('says the heading is written from the place, and how to use one of your own', async () => {
    const view = await render(
      <ScreenplaySceneHeader
        place={{ name: 'Kitchen', intExt: 'interior' }}
        cast={['Mom', 'Sam']}
        plan={{ source: 'location', heading: 'INT. KITCHEN' }}
      />,
    );

    expect(view.getByTestId('screenplay-place').props.children.join('')).toContain(
      'Kitchen (int_ext_interior)',
    );
    expect(view.getByTestId('screenplay-cast').props.children.join('')).toContain('Mom, Sam');
    expect(view.getByTestId('screenplay-heading-location').props.children).toBe(
      'screenplay_scene_heading_location',
    );
  });

  it("says the heading is the writer's own when the text starts with one", async () => {
    const view = await render(
      <ScreenplaySceneHeader
        place={null}
        cast={[]}
        plan={{ source: 'body', heading: 'INT. CELLAR - NIGHT' }}
      />,
    );

    expect(view.getByTestId('screenplay-heading-body')).toBeTruthy();
    expect(view.getByTestId('screenplay-place').props.children.join('')).toContain(
      'screenplay_scene_no_place',
    );
    expect(view.getByTestId('screenplay-cast').props.children.join('')).toContain(
      'screenplay_scene_no_cast',
    );
  });

  it('warns when there will be no heading at all', async () => {
    const view = await render(
      <ScreenplaySceneHeader place={null} cast={[]} plan={{ source: 'none', heading: null }} />,
    );

    expect(view.getByTestId('screenplay-heading-none')).toBeTruthy();
    expect(view.queryByTestId('screenplay-heading')).toBeNull();
  });

  it('shows a forced heading without its leading dot', async () => {
    const view = await render(
      <ScreenplaySceneHeader
        place={{ name: 'The Void', intExt: null }}
        cast={[]}
        plan={{ source: 'location', heading: '.THE VOID' }}
      />,
    );

    expect(view.getByTestId('screenplay-heading').props.children[1].props.children).toBe(
      'THE VOID',
    );
  });
});
