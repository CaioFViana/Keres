import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockOpenPresenceMatrix = jest.fn();
const mockGetCharacterById = jest.fn();
const mockGetAllCharactersByStoryId = jest.fn();
const mockGetRelationsForCharacter = jest.fn();
const mockGetCharacterSceneRelations = jest.fn();
const mockGetScenesByStoryId = jest.fn();
const mockGetAllItemsByStoryId = jest.fn();
const mockGetAllItemJourneysByStoryId = jest.fn();
const mockGetAllLocationsByStoryId = jest.fn();

let mockSelectedStory: { id: string; type: string; statSystem?: boolean } | null = {
  id: 'story-1',
  type: 'linear',
  statSystem: false,
};
let mockStatModes: { characterId: string; id: string }[] = [];

// Stable identities: the screen's loader callbacks depend on these, so a fresh
// object per render would re-trigger the initial load forever.
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };
const mockT = (key: string) => key;
const mockCharacterCopy = {
  detailsTitle: 'Character details',
  notFound: 'Character not found',
  failedToLoad: 'Failed to load character',
  loadingDetails: 'Loading character',
  dataMissing: 'Character data missing',
};
const mockSceneCopy = { entity: 'Scene' };
const mockLocationCopy = { entities: 'Locations' };

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { characterId: 'char-1' } }),
}));
const mockDrizzleDb = {};
jest.mock('../../../src/db', () => ({ __esModule: true, useDrizzle: () => mockDrizzleDb }));
jest.mock('../../../src/hooks/useBackButtonHandler', () => ({
  __esModule: true,
  useBackButtonHandler: () => undefined,
}));
jest.mock('../../../src/hooks/useScreenHeader', () => ({
  __esModule: true,
  useScreenHeader: (config: unknown) => mockUseScreenHeader(config),
}));
jest.mock('../../../src/hooks/useEntityComments', () => ({
  __esModule: true,
  useEntityComments: () => ({
    commentsByField: {},
    canComment: false,
    isStoryOwner: false,
    currentUserId: null,
    addComment: jest.fn(),
    deleteComment: jest.fn(),
    updateComment: jest.fn(),
  }),
}));
jest.mock('../../../src/hooks/useEntityRelations', () => ({
  __esModule: true,
  useEntityRelations: () => ({
    selectedTags: [{ id: 'tag-1', name: 'Hero' }],
    allNotes: [{ id: 'note-1' }],
    noteRelations: [{ id: 'nr-1' }],
    saveNoteRelation: jest.fn(),
    deleteNoteRelation: jest.fn(),
  }),
}));
jest.mock('../../../src/hooks/useAppearsInArcs', () => ({
  __esModule: true,
  useAppearsInArcs: () => [{ id: 'arc-1' }],
}));
jest.mock('../../../src/hooks/useOpenGalleryMediaViewer', () => ({
  __esModule: true,
  useOpenGalleryMediaViewer: () => jest.fn(),
}));
jest.mock('../../../src/hooks/useOpenPresenceMatrixViewer', () => ({
  __esModule: true,
  useOpenPresenceMatrixViewer: () => ({ openCharacter: mockOpenPresenceMatrix }),
}));
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: true }),
}));
jest.mock('../../../src/hooks/useStoryStats', () => ({
  __esModule: true,
  useStoryStats: () => ({ modes: mockStatModes, stats: [] }),
}));
jest.mock('../../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: () => ({
    getById: mockGetCharacterById,
    getAllByStoryId: mockGetAllCharactersByStoryId,
  }),
}));
jest.mock('../../../src/services/storymanagement/CharacterRelationService', () => ({
  __esModule: true,
  createCharacterRelationService: () => ({
    getRelationsForCharacter: mockGetRelationsForCharacter,
  }),
}));
jest.mock('../../../src/services/storymanagement/CharacterSceneService', () => ({
  __esModule: true,
  createCharacterSceneService: () => ({
    getRelationsForCharacter: mockGetCharacterSceneRelations,
  }),
}));
jest.mock('../../../src/services/storymanagement/ItemService', () => ({
  __esModule: true,
  createItemService: () => ({ getAllByStoryId: mockGetAllItemsByStoryId }),
}));
jest.mock('../../../src/services/storymanagement/ItemJourneyService', () => ({
  __esModule: true,
  createItemJourneyService: () => ({ getAllByStoryId: mockGetAllItemJourneysByStoryId }),
}));
jest.mock('../../../src/services/storymanagement/LocationService', () => ({
  __esModule: true,
  createLocationService: () => ({ getAllByStoryId: mockGetAllLocationsByStoryId }),
}));
jest.mock('../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getScenesByStoryId: mockGetScenesByStoryId }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: mockSelectedStory }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../src/theme', () => ({
  __esModule: true,
  useTheme: () => ({ colors: { textSecondary: '#555' } }),
}));
jest.mock('../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: (entity: string) => {
    if (entity === 'Character') return mockCharacterCopy;
    if (entity === 'Scene') return mockSceneCopy;
    return mockLocationCopy;
  },
}));
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => ({
  __esModule: true,
  ScreenLoading: ({ message }: { message?: string }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-loading' }, message ?? 'loading');
  },
  ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(native.Text, { testID: 'screen-error', onPress: onGoBack }, message);
  },
}));
jest.mock('../../../src/screens/characters/CharacterDetailContent', () => ({
  __esModule: true,
  CharacterDetailContent: (props: {
    character: { name: string };
    characterTags: unknown[];
    characterRelations: unknown[];
    allCharacters: unknown[];
    characterSceneRelations: unknown[];
    allScenes: unknown[];
    allItems: unknown[];
    characterModes: unknown[];
    characterNoteRelations: unknown[];
    allNotes: unknown[];
    appearingArcs: unknown[];
    statSystemEnabled: boolean;
    navigation: { goBack: () => void };
  }) => {
    const react = jest.requireActual('react') as typeof import('react');
    const native = jest.requireActual('react-native') as typeof import('react-native');
    return react.createElement(
      native.View,
      null,
      react.createElement(
        native.Text,
        { testID: 'content-marker' },
        JSON.stringify({
          name: props.character.name,
          tags: props.characterTags.length,
          relations: props.characterRelations.length,
          characters: props.allCharacters.length,
          sceneRelations: props.characterSceneRelations.length,
          scenes: props.allScenes.length,
          items: props.allItems.length,
          modes: props.characterModes.length,
          noteRelations: props.characterNoteRelations.length,
          notes: props.allNotes.length,
          arcs: props.appearingArcs.length,
          stats: props.statSystemEnabled,
        }),
      ),
      react.createElement(
        native.Text,
        { testID: 'content-back', onPress: () => props.navigation.goBack() },
        'back',
      ),
    );
  },
}));
jest.mock('react-i18next', () => {
  const actual = jest.requireActual('react-i18next');
  return {
    ...actual,
    __esModule: true,
    useTranslation: () => ({ t: mockT }),
  };
});

import CharacterDetailScreen from '../../../src/screens/characters/CharacterDetailScreen';

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeCharacter(overrides = {}) {
  return {
    id: 'char-1',
    storyId: 'story-1',
    name: 'Aria',
    title: null,
    gender: null,
    race: null,
    subrace: null,
    description: null,
    personality: null,
    motivation: null,
    qualities: null,
    weaknesses: null,
    biography: null,
    plannedTimeline: null,
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

function jsonOf(view: { getByTestId: (id: string) => { props: { children?: unknown } } }) {
  return JSON.parse(view.getByTestId('content-marker').props.children as string);
}

describe('CharacterDetailScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedStory = { id: 'story-1', type: 'linear', statSystem: false };
    mockStatModes = [];
    mockGetCharacterById.mockResolvedValue(makeCharacter());
    mockGetAllCharactersByStoryId.mockResolvedValue([
      makeCharacter(),
      makeCharacter({ id: 'char-2', name: 'Bram', isDeleted: true }),
    ]);
    mockGetRelationsForCharacter.mockResolvedValue([{ id: 'rel-1' }]);
    mockGetCharacterSceneRelations.mockResolvedValue([]);
    mockGetScenesByStoryId.mockResolvedValue([]);
    mockGetAllItemsByStoryId.mockResolvedValue([]);
    mockGetAllItemJourneysByStoryId.mockResolvedValue([]);
    mockGetAllLocationsByStoryId.mockResolvedValue([]);
  });

  it('loads the character and its associations into the content', async () => {
    mockStatModes = [
      { id: 'mode-1', characterId: 'char-1' },
      { id: 'mode-2', characterId: 'char-2' },
    ];
    const view = await render(<CharacterDetailScreen />);
    await waitFor(() => expect(mockGetCharacterById).toHaveBeenCalledWith('char-1'));
    await waitFor(() => expect(view.queryByTestId('content-marker')).not.toBeNull());
    expect(jsonOf(view)).toMatchObject({
      name: 'Aria',
      tags: 1,
      relations: 1,
      characters: 1,
      modes: 1,
      noteRelations: 1,
      notes: 1,
      arcs: 1,
      stats: false,
    });
    expect(mockGetRelationsForCharacter).toHaveBeenCalledWith('story-1', 'char-1');
    const headerCall = mockUseScreenHeader.mock.calls[
      mockUseScreenHeader.mock.calls.length - 1
    ][0] as { title: string };
    expect(headerCall.title).toBe('Aria');
  });

  it('wires the header actions for the presence matrix and editing', async () => {
    const view = await render(<CharacterDetailScreen />);
    await waitFor(() => expect(view.queryByTestId('content-marker')).not.toBeNull());
    const headerCall = mockUseScreenHeader.mock.calls[
      mockUseScreenHeader.mock.calls.length - 1
    ][0] as { actions: { onPress: () => void; visible?: boolean }[] };
    expect(headerCall.actions[0].visible).toBe(true);
    headerCall.actions[0].onPress();
    expect(mockOpenPresenceMatrix).toHaveBeenCalledWith('char-1');
    headerCall.actions[1].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('CharacterForm', { characterId: 'char-1' });
  });

  it('shows the error state when loading fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetCharacterById.mockRejectedValue(new Error('db down'));
    try {
      const view = await render(<CharacterDetailScreen />);
      await waitFor(() => expect(view.queryByTestId('screen-error')).not.toBeNull());
      expect(view.getByTestId('screen-error').props.children).toBe('Failed to load character');
      await fireEvent.press(view.getByTestId('screen-error'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('shows the not-found state for a missing character', async () => {
    mockGetCharacterById.mockResolvedValue(null);
    const view = await render(<CharacterDetailScreen />);
    await waitFor(() => expect(view.queryByTestId('screen-error')).not.toBeNull());
    expect(view.getByTestId('screen-error').props.children).toBe('Character not found');
  });

  it('goes back for a deleted character', async () => {
    mockGetCharacterById.mockResolvedValue(makeCharacter({ isDeleted: true }));
    await render(<CharacterDetailScreen />);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });
});
