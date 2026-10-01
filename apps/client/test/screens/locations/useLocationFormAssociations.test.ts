const mockUseEntityRelations = jest.fn();
const mockSetSelectedTagIds = jest.fn();
const mockAlert = jest.fn();
const mockReadDraft = jest.fn();
const mockPatchDraft = jest.fn();

jest.mock('../../../src/hooks/useEntityRelations', () => ({
  useEntityRelations: (...args: unknown[]) => mockUseEntityRelations(...args),
}));
jest.mock('../../../src/services/storymanagement/EntityFormSecondaryDraftStore', () => ({
  readEntityFormSecondaryDraft: (...args: unknown[]) => mockReadDraft(...args),
  patchEntityFormSecondaryDraft: (...args: unknown[]) => mockPatchDraft(...args),
}));
jest.mock('../../../src/utils/AppAlert', () => ({
  AppAlert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { LocationRelationSelect } from '../../../src/db/schema';
import { useLocationFormAssociations } from '../../../src/screens/locations/useLocationFormAssociations';

const stubRelations = () => ({
  availableTags: [],
  selectedTagIds: [],
  setSelectedTagIds: mockSetSelectedTagIds,
  selectedTags: [],
  allNotes: [],
  noteRelations: [],
  pendingNoteRelations: [],
  persistTagRelations: jest.fn(),
  saveNoteRelation: jest.fn(),
  deleteNoteRelation: jest.fn(),
  persistNoteRelations: jest.fn(),
  refresh: jest.fn(),
  refreshNotes: jest.fn(),
  refreshNoteRelations: jest.fn(),
});

const renderAssociations = async (options?: {
  initialLocationId?: string;
  currentLocationId?: string;
  locations?: object[];
  relations?: Partial<LocationRelationSelect>[];
  onSecondaryDraftRestored?: () => void;
}) => {
  const getAllByStoryId = jest.fn().mockResolvedValue(options?.locations ?? []);
  const getAllRelationsForStory = jest.fn().mockResolvedValue(options?.relations ?? []);
  const setParent = jest.fn(async () => undefined);
  const addConnection = jest.fn(async () => undefined);
  const removeRelation = jest.fn(async () => undefined);
  const locationServiceRef = { current: { getAllByStoryId } as never };
  const locationRelationServiceRef = {
    current: { getAllRelationsForStory, setParent, addConnection, removeRelation } as never,
  };
  const view = await renderHook(() =>
    useLocationFormAssociations({
      initialLocationId: options?.initialLocationId,
      currentLocationId: options?.currentLocationId,
      storyId: 'story-1',
      userId: 'user-1',
      locationServiceRef,
      locationRelationServiceRef,
      onSecondaryDraftRestored: options?.onSecondaryDraftRestored,
    }),
  );
  return {
    getAllByStoryId,
    getAllRelationsForStory,
    setParent,
    addConnection,
    removeRelation,
    view,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseEntityRelations.mockReturnValue(stubRelations());
  mockReadDraft.mockResolvedValue(null);
  mockPatchDraft.mockResolvedValue(undefined);
});

it('loads live locations and story relations for the form', async () => {
  const { getAllByStoryId, getAllRelationsForStory, view } = await renderAssociations({
    currentLocationId: 'loc-1',
    locations: [
      { id: 'loc-1', name: 'Keep', isDeleted: false },
      { id: 'loc-2', name: 'Ruin', isDeleted: true },
    ],
    relations: [{ id: 'rel-1' }],
  });

  await waitFor(() => expect(getAllByStoryId).toHaveBeenCalledWith('story-1'));
  await waitFor(() => expect(getAllRelationsForStory).toHaveBeenCalledWith('story-1'));

  expect(view.result.current.allLocations.map((l) => l.id)).toEqual(['loc-1']);
  expect(view.result.current.allLocationRelations.map((r) => r.id)).toEqual(['rel-1']);
  expect(view.result.current.locationNoteRelations).toEqual([]);
});

it('holds parent intent as pending edges until the location exists', async () => {
  const { setParent, view } = await renderAssociations();

  await act(async () => {
    await view.result.current.handleSetParent('loc-parent');
  });

  expect(setParent).not.toHaveBeenCalled();
  expect(view.result.current.pendingLocationRelations).toHaveLength(1);
  expect(view.result.current.pendingLocationRelations[0]).toMatchObject({
    relationType: 'contains',
    locationAId: 'loc-parent',
    locationBId: '',
  });

  await act(async () => {
    await view.result.current.handleSetParent(null);
  });
  expect(view.result.current.pendingLocationRelations).toEqual([]);
});

it('writes parent changes through the service once the location exists', async () => {
  const { setParent, getAllRelationsForStory, view } = await renderAssociations({
    initialLocationId: 'loc-1',
    currentLocationId: 'loc-1',
  });

  await act(async () => {
    await view.result.current.handleSetParent('loc-parent');
  });

  expect(setParent).toHaveBeenCalledWith('user-1', 'story-1', 'loc-1', 'loc-parent');
  expect(getAllRelationsForStory).toHaveBeenCalled();
});

it('replays pending children and connections against the retained id', async () => {
  const { setParent, addConnection, view } = await renderAssociations({
    currentLocationId: undefined,
  });

  await act(async () => {
    await view.result.current.handleAddChild('loc-child');
    await view.result.current.handleAddConnection('loc-other');
  });
  expect(view.result.current.pendingLocationRelations).toHaveLength(2);

  await act(async () => {
    await view.result.current.persistPendingLocationRelations('loc-created');
  });

  expect(setParent).toHaveBeenCalledWith('user-1', 'story-1', 'loc-child', 'loc-created');
  expect(addConnection).toHaveBeenCalledWith('user-1', 'story-1', 'loc-created', 'loc-other');
  expect(view.result.current.pendingLocationRelations).toEqual([]);
});

it('removes pending relations locally without touching the service', async () => {
  const { removeRelation, view } = await renderAssociations();

  await act(async () => {
    await view.result.current.handleAddChild('loc-child');
  });
  const pendingId = view.result.current.pendingLocationRelations[0].id;

  await act(async () => {
    await view.result.current.handleRemoveLocationRelation(pendingId);
  });

  expect(view.result.current.pendingLocationRelations).toEqual([]);
  expect(removeRelation).not.toHaveBeenCalled();
});

it('removes persisted relations through the service', async () => {
  const { removeRelation, view } = await renderAssociations({
    initialLocationId: 'loc-1',
    currentLocationId: 'loc-1',
    relations: [{ id: 'rel-persisted' }],
  });

  await act(async () => {
    await view.result.current.handleRemoveLocationRelation('rel-persisted');
  });

  expect(removeRelation).toHaveBeenCalledWith('user-1', 'rel-persisted');
});

it('restores durable pending relations and forwards tag changes', async () => {
  mockReadDraft.mockResolvedValue({ pendingEntityRelations: [{ id: 'draft-rel' }] });
  const onSecondaryDraftRestored = jest.fn();
  const { view } = await renderAssociations({
    initialLocationId: 'loc-1',
    currentLocationId: 'loc-1',
    onSecondaryDraftRestored,
  });

  await waitFor(() =>
    expect(view.result.current.pendingLocationRelations.map((r) => r.id)).toEqual(['draft-rel']),
  );
  expect(onSecondaryDraftRestored).toHaveBeenCalled();

  await act(async () => {
    view.result.current.handleTagSelectionChange(['tag-1']);
  });
  expect(mockSetSelectedTagIds).toHaveBeenCalledWith(['tag-1']);
});
