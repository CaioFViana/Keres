import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockUseScreenHeader = jest.fn();
const mockGetLocationById = jest.fn();
const mockGetAllLocationsByStoryId = jest.fn();
const mockGetAllLocationRelations = jest.fn();
const mockSetParent = jest.fn();
const mockAddConnection = jest.fn();
const mockRemoveRelation = jest.fn();
const mockGetAllCharactersByStoryId = jest.fn();
const mockGetCharacterSceneRelations = jest.fn();
const mockGetScenesByStoryId = jest.fn();
const mockGetAllItemsByStoryId = jest.fn();
const mockGetAllItemJourneysByStoryId = jest.fn();
const mockAppAlert = jest.fn();

// Stable identities: the screen's loader callbacks depend on these.
const mockNavigation = { navigate: mockNavigate, goBack: mockGoBack };
const mockT = (key: string) => key;
const mockDrizzleDb = {};
const mockLocationCopy = {
  detailsTitle: 'Location details',
  notFound: 'Location not found',
  failedToLoad: 'Failed to load location',
  loadingDetails: 'Loading location',
  dataMissing: 'Location data missing',
};
const mockSceneCopy = { entity: 'Scene' };

jest.mock('@react-navigation/native', () => ({
  __esModule: true,
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { locationId: 'loc-1' } }),
}));
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
    selectedTags: [{ id: 'tag-1', name: 'City' }],
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
jest.mock('../../../src/hooks/useStoryRole', () => ({
  __esModule: true,
  useStoryRole: () => ({ canEdit: true }),
}));
jest.mock('../../../src/services/storymanagement/LocationService', () => ({
  __esModule: true,
  createLocationService: () => ({
    getById: mockGetLocationById,
    getAllByStoryId: mockGetAllLocationsByStoryId,
  }),
}));
jest.mock('../../../src/services/storymanagement/LocationRelationService', () => ({
  __esModule: true,
  createLocationRelationService: () => ({
    getAllRelationsForStory: mockGetAllLocationRelations,
    setParent: mockSetParent,
    addConnection: mockAddConnection,
    removeRelation: mockRemoveRelation,
  }),
}));
jest.mock('../../../src/services/storymanagement/CharacterService', () => ({
  __esModule: true,
  createCharacterService: () => ({ getAllByStoryId: mockGetAllCharactersByStoryId }),
}));
jest.mock('../../../src/services/storymanagement/CharacterSceneService', () => ({
  __esModule: true,
  createCharacterSceneService: () => ({
    getRelationsByStoryId: mockGetCharacterSceneRelations,
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
jest.mock('../../../src/services/storymanagement/SceneService', () => ({
  __esModule: true,
  createSceneService: () => ({ getScenesByStoryId: mockGetScenesByStoryId }),
}));
jest.mock('../../../src/state/storyStore', () => ({
  __esModule: true,
  useStoryStore: () => ({ selectedStory: { id: 'story-1' } }),
}));
jest.mock('../../../src/state/userSettingsStore', () => ({
  __esModule: true,
  useUserSettingsStore: () => ({ userId: 'user-1' }),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  __esModule: true,
  AppAlert: { alert: (...args: unknown[]) => mockAppAlert(...args) },
}));
jest.mock('../../../src/vocabulary/useVocabularyEntityCopy', () => ({
  __esModule: true,
  useVocabularyEntityCopy: (entity: string) =>
    entity === 'Location' ? mockLocationCopy : mockSceneCopy,
}));
jest.mock('../../../src/components/common/feedback/ScreenState/ScreenState', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    ScreenLoading: ({ message }: { message?: string }) => (
      <Text testID="screen-loading">{message ?? 'loading'}</Text>
    ),
    ScreenError: ({ message, onGoBack }: { message: string; onGoBack: () => void }) => (
      <Text testID="screen-error" onPress={onGoBack}>
        {message}
      </Text>
    ),
  };
});
jest.mock('../../../src/components/layout/DetailContainer/DetailContainer', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title, children }: { title: string; children?: ReactNode }) => (
      <>
        <Text testID="detail-title">{title}</Text>
        {children}
      </>
    ),
  };
});
jest.mock('../../../src/components/layout/ScreenSection/ScreenSection', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ title }: { title: string }) => <Text testID={`section-${title}`}>{title}</Text>,
  };
});
jest.mock('../../../src/components/common/display/TagList/TagList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ tags, emptyMessage }: { tags: { name: string }[]; emptyMessage: string }) => (
      <Text testID="tag-list">
        {tags.length === 0 ? emptyMessage : tags.map((tag) => tag.name).join(',')}
      </Text>
    ),
  };
});
jest.mock(
  '../../../src/components/features/comments/CommentableDetailField/CommentableDetailField',
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
  '../../../src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: ({ entityId }: { entityId: string }) => (
        <Text testID="custom-attrs">{entityId}</Text>
      ),
    };
  },
);
jest.mock('../../../src/components/features/gallery/GalleryManager/EntityGalleryManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ ownerId, ownerType }: { ownerId: string; ownerType: string }) => (
      <Text testID="gallery-marker">{`${ownerType}:${ownerId}`}</Text>
    ),
  };
});
jest.mock(
  '../../../src/components/features/relations/LocationRelationManager/LocationRelationManager',
  () => {
    const { Text } = require('react-native');
    return {
      __esModule: true,
      default: (props: {
        currentLocationId: string;
        allLocations: unknown[];
        allLocationRelations: unknown[];
        onSetParent: (id: string | null) => void;
        onAddChild: (id: string) => void;
        onAddConnection: (id: string) => void;
        onRemoveRelation: (id: string) => void;
      }) => (
        <>
          <Text testID="relation-manager">
            {JSON.stringify({
              current: props.currentLocationId,
              locations: props.allLocations.length,
              relations: props.allLocationRelations.length,
            })}
          </Text>
          <Text testID="rel-set-parent" onPress={() => props.onSetParent('loc-parent')}>
            parent
          </Text>
          <Text testID="rel-add-child" onPress={() => props.onAddChild('loc-child')}>
            child
          </Text>
          <Text testID="rel-add-connection" onPress={() => props.onAddConnection('loc-peer')}>
            peer
          </Text>
          <Text testID="rel-remove" onPress={() => props.onRemoveRelation('rel-1')}>
            remove
          </Text>
        </>
      ),
    };
  },
);
jest.mock('../../../src/components/features/scenes/ScenePresenceList/ScenePresenceList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    groupScenePresenceEntries: (pairs: { item: { id: string }; scene: { id: string } }[]) => {
      const grouped = new Map<string, { item: unknown; scenes: unknown[] }>();
      for (const { item, scene } of pairs) {
        const entry = grouped.get(item.id) ?? { item, scenes: [] };
        grouped.set(item.id, entry);
        entry.scenes.push(scene);
      }
      return Array.from(grouped.values());
    },
    default: (props: { entries: unknown[]; title: string }) => (
      <Text testID="presence-list">{`${props.title}:${props.entries.length}`}</Text>
    ),
  };
});
jest.mock('../../../src/components/features/scenes/RelatedScenesList/RelatedScenesList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      scenes: { id: string; locationId?: string | null }[];
      matchesScene: (scene: { id: string }) => boolean;
    }) => (
      <Text testID="related-scenes">{`scenes:${props.scenes.filter(props.matchesScene).length}`}</Text>
    ),
  };
});
jest.mock('../../../src/components/features/locations/LocationManager/LocationItemManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: {
      availableItems: unknown[];
      availableItemJourneys: unknown[];
      availableScenes: unknown[];
      availableCharacters: unknown[];
    }) => (
      <Text testID="item-manager">
        {JSON.stringify({
          items: props.availableItems.length,
          journeys: props.availableItemJourneys.length,
          scenes: props.availableScenes.length,
          characters: props.availableCharacters.length,
        })}
      </Text>
    ),
  };
});
jest.mock('../../../src/components/features/notes/NoteManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (props: { noteRelations: unknown[]; availableNotes: unknown[] }) => (
      <Text testID="note-relations">
        {JSON.stringify({
          relations: props.noteRelations.length,
          notes: props.availableNotes.length,
        })}
      </Text>
    ),
  };
});
jest.mock('../../../src/components/features/arcs/AppearsInArcsSection', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ arcs }: { arcs: unknown[] }) => (
      <Text testID="arcs-marker">{`arcs:${arcs.length}`}</Text>
    ),
  };
});
jest.mock('../../../src/components/features/seealso/SeeAlsoManager/SeeAlsoManager', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="seealso-marker">seealso</Text>,
  };
});
jest.mock('../../../src/components/features/favorites/FavoritedByList/FavoritedByList', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="favorited-marker">favorited</Text>,
  };
});
jest.mock('../../../src/components/features/mentions/EntityMetadataWithBacklinks', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => <Text testID="entity-metadata">metadata</Text>,
  };
});
jest.mock('react-i18next', () => {
  const actual = jest.requireActual('react-i18next');
  return {
    ...actual,
    __esModule: true,
    useTranslation: () => ({ t: mockT }),
  };
});

import LocationDetailsScreen from '../../../src/screens/locations/LocationDetailsScreen';

const stamp = new Date('2026-01-01T00:00:00.000Z');

function makeLocation(overrides = {}) {
  return {
    id: 'loc-1',
    storyId: 'story-1',
    name: 'Keep',
    description: 'A stronghold',
    climate: null,
    culture: null,
    politics: null,
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

function makeScene(id: string, locationId: string | null) {
  return {
    id,
    storyId: 'story-1',
    chapterId: null,
    locationId,
    name: `Scene ${id}`,
    index: 0,
    summary: null,
    createdAt: stamp,
    updatedAt: stamp,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  };
}

type View = { getByTestId: (id: string) => { props: { children: unknown } } };

function jsonOf(view: View, testID: string) {
  return JSON.parse(view.getByTestId(testID).props.children as string);
}

describe('LocationDetailsScreen', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLocationById.mockResolvedValue(makeLocation());
    mockGetAllLocationsByStoryId.mockResolvedValue([
      makeLocation(),
      makeLocation({ id: 'loc-2', name: 'Harbor' }),
    ]);
    mockGetAllLocationRelations.mockResolvedValue([{ id: 'rel-1' }]);
    mockSetParent.mockResolvedValue(undefined);
    mockAddConnection.mockResolvedValue(undefined);
    mockRemoveRelation.mockResolvedValue(undefined);
    mockGetAllCharactersByStoryId.mockResolvedValue([]);
    mockGetCharacterSceneRelations.mockResolvedValue([]);
    mockGetScenesByStoryId.mockResolvedValue([
      makeScene('scene-1', 'loc-1'),
      makeScene('scene-2', 'loc-2'),
    ]);
    mockGetAllItemsByStoryId.mockResolvedValue([]);
    mockGetAllItemJourneysByStoryId.mockResolvedValue([]);
  });

  it('loads the location and its associations into the detail view', async () => {
    const view = await render(<LocationDetailsScreen />);
    await waitFor(() => expect(mockGetLocationById).toHaveBeenCalledWith('loc-1'));
    await waitFor(() => expect(view.queryByTestId('detail-title')).not.toBeNull());
    expect(view.getByTestId('detail-title').props.children).toBe('Keep');
    expect(view.getByTestId('tag-list').props.children).toBe('City');
    expect(view.getByTestId('commentable-description').props.children).toBe(
      'description:A stronghold',
    );
    expect(view.getByTestId('commentable-field_climate').props.children).toBe(
      'field_climate:common_na',
    );
    expect(view.getByTestId('custom-attrs').props.children).toBe('loc-1');
    expect(view.getByTestId('gallery-marker').props.children).toBe('Location:loc-1');
    expect(jsonOf(view, 'relation-manager')).toEqual({
      current: 'loc-1',
      locations: 2,
      relations: 1,
    });
    expect(view.getByTestId('presence-list').props.children).toBe('characters_in_location_title:0');
    expect(view.getByTestId('related-scenes').props.children).toBe('scenes:1');
    expect(jsonOf(view, 'item-manager')).toMatchObject({ scenes: 2 });
    expect(jsonOf(view, 'note-relations')).toEqual({ relations: 1, notes: 1 });
    expect(view.getByTestId('arcs-marker').props.children).toBe('arcs:1');
    expect(view.getByTestId('seealso-marker')).toBeTruthy();
    expect(view.getByTestId('favorited-marker')).toBeTruthy();
    expect(view.getByTestId('entity-metadata')).toBeTruthy();
    const headerCall = mockUseScreenHeader.mock.calls[
      mockUseScreenHeader.mock.calls.length - 1
    ][0] as { title: string };
    expect(headerCall.title).toBe('Keep');
  });

  it('navigates to the form through the header edit action', async () => {
    const view = await render(<LocationDetailsScreen />);
    await waitFor(() => expect(view.queryByTestId('detail-title')).not.toBeNull());
    const headerCall = mockUseScreenHeader.mock.calls[
      mockUseScreenHeader.mock.calls.length - 1
    ][0] as { actions: { onPress: () => void; visible?: boolean }[] };
    expect(headerCall.actions[0].visible).toBe(true);
    headerCall.actions[0].onPress();
    expect(mockNavigate).toHaveBeenCalledWith('LocationForm', { locationId: 'loc-1' });
  });

  it('saves location relations through the relation manager', async () => {
    const view = await render(<LocationDetailsScreen />);
    await waitFor(() => expect(view.queryByTestId('relation-manager')).not.toBeNull());
    await fireEvent.press(view.getByTestId('rel-set-parent'));
    expect(mockSetParent).toHaveBeenCalledWith('user-1', 'story-1', 'loc-1', 'loc-parent');
    await fireEvent.press(view.getByTestId('rel-add-child'));
    expect(mockSetParent).toHaveBeenCalledWith('user-1', 'story-1', 'loc-child', 'loc-1');
    await fireEvent.press(view.getByTestId('rel-add-connection'));
    expect(mockAddConnection).toHaveBeenCalledWith('user-1', 'story-1', 'loc-1', 'loc-peer');
    await fireEvent.press(view.getByTestId('rel-remove'));
    expect(mockRemoveRelation).toHaveBeenCalledWith('user-1', 'rel-1');
    expect(mockAppAlert).not.toHaveBeenCalled();
  });

  it('alerts when saving a relation fails', async () => {
    mockSetParent.mockRejectedValue(new Error('cycle detected'));
    const view = await render(<LocationDetailsScreen />);
    await waitFor(() => expect(view.queryByTestId('relation-manager')).not.toBeNull());
    await fireEvent.press(view.getByTestId('rel-set-parent'));
    await waitFor(() => expect(mockAppAlert).toHaveBeenCalled());
    expect(mockAppAlert).toHaveBeenCalledWith('error', 'cycle detected');
  });

  it('shows the error state when loading fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockGetLocationById.mockRejectedValue(new Error('db down'));
    try {
      const view = await render(<LocationDetailsScreen />);
      await waitFor(() => expect(view.queryByTestId('screen-error')).not.toBeNull());
      expect(view.getByTestId('screen-error').props.children).toBe('Failed to load location');
      await fireEvent.press(view.getByTestId('screen-error'));
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('shows the not-found state for a missing location', async () => {
    mockGetLocationById.mockResolvedValue(null);
    const view = await render(<LocationDetailsScreen />);
    await waitFor(() => expect(view.queryByTestId('screen-error')).not.toBeNull());
    expect(view.getByTestId('screen-error').props.children).toBe('Location not found');
  });

  it('goes back for a deleted location', async () => {
    mockGetLocationById.mockResolvedValue(makeLocation({ isDeleted: true }));
    await render(<LocationDetailsScreen />);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });
});
