/**
 * @jest-environment node
 */
jest.mock('../../src/db', () => ({ __esModule: true, useDrizzle: jest.fn() }));
jest.mock('../../src/state/storyStore', () => ({ __esModule: true, useStoryStore: jest.fn() }));
jest.mock('../../src/state/userSettingsStore', () => ({ __esModule: true, useUserSettingsStore: jest.fn() }));
jest.mock('react-i18next', () => ({ __esModule: true, useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../../src/utils/AppAlert', () => ({ __esModule: true, AppAlert: { alert: jest.fn() } }));
jest.mock('../../src/services/storymanagement/TagService', () => ({
  __esModule: true,
  createTagService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/TagRelationService', () => ({
  __esModule: true,
  createTagRelationService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/NoteService', () => ({
  __esModule: true,
  createNoteService: jest.fn(),
}));
jest.mock('../../src/services/storymanagement/NoteRelationService', () => ({
  __esModule: true,
  createNoteRelationService: jest.fn(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useDrizzle } from '../../src/db';
import { useEntityRelations } from '../../src/hooks/useEntityRelations';
import { createNoteRelationService } from '../../src/services/storymanagement/NoteRelationService';
import { createNoteService } from '../../src/services/storymanagement/NoteService';
import { createTagRelationService } from '../../src/services/storymanagement/TagRelationService';
import { createTagService } from '../../src/services/storymanagement/TagService';
import { useStoryStore } from '../../src/state/storyStore';
import { useUserSettingsStore } from '../../src/state/userSettingsStore';
import { AppAlert } from '../../src/utils/AppAlert';
import { entityEventEmitter } from '../../src/utils/EventEmitter';

const STORY_ID = 'story-1';
const ENTITY_ID = 'rule-1';
const USER_ID = 'local-user';
const ENTITY_TYPE = 'WorldRule' as never;

const TAGS = [
  { id: 't1', name: 'Vilões' },
  { id: 't2', name: 'Heróis' },
];
const NOTES = [{ id: 'n1', title: 'Ideia' }];
const RELATION = { id: 'r1', noteId: 'n1' };

const tagService = { getTagsByStoryId: jest.fn(async () => TAGS) };
const tagRelationService = {
  getTagsForEntity: jest.fn(async () => [TAGS[0]]),
  updateTagsForEntity: jest.fn(async () => undefined),
};
const noteService = { getNotesByStoryId: jest.fn(async () => NOTES) };

/**
 * O dublê guarda estado porque o hook, ao salvar ou excluir, emite `note_relation_changed` e
 * ouve o próprio evento - relendo o serviço logo em seguida. Com um retorno fixo, essa releitura
 * desfaria a escrita e o teste mediria o mock, não o hook.
 */
let storedRelations: { id: string; noteId: string }[] = [];
const noteRelationService = {
  getRelationsForEntity: jest.fn(async () => [...storedRelations]),
  saveNoteRelation: jest.fn(async (_userId: string, relation: any) => {
    const saved = { ...RELATION, ...relation, id: relation.id ?? RELATION.id };
    const index = storedRelations.findIndex((r) => r.id === saved.id);
    storedRelations = index > -1
      ? storedRelations.map((r, i) => (i === index ? saved : r))
      : [...storedRelations, saved];
    return saved;
  }),
  deleteNoteRelation: jest.fn(async (_userId: string, relationId: string) => {
    storedRelations = storedRelations.filter((r) => r.id !== relationId);
    return true;
  }),
};

const alert = (AppAlert as unknown as { alert: jest.Mock }).alert;

async function render(options: Record<string, unknown> = {}) {
  const view = await renderHook(() =>
    useEntityRelations({ entityType: ENTITY_TYPE, entityId: ENTITY_ID, ...options } as never),
  );
  await waitFor(() => expect(view.result.current.availableTags.length + view.result.current.allNotes.length).toBeGreaterThan(0));
  return view;
}

beforeEach(() => {
  jest.clearAllMocks();
  (useDrizzle as jest.Mock).mockReturnValue({ marker: 'db' });
  (useStoryStore as unknown as jest.Mock).mockReturnValue({ selectedStory: { id: STORY_ID } });
  (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: USER_ID });
  (createTagService as jest.Mock).mockReturnValue(tagService);
  (createTagRelationService as jest.Mock).mockReturnValue(tagRelationService);
  (createNoteService as jest.Mock).mockReturnValue(noteService);
  (createNoteRelationService as jest.Mock).mockReturnValue(noteRelationService);
  tagService.getTagsByStoryId.mockResolvedValue(TAGS);
  tagRelationService.getTagsForEntity.mockResolvedValue([TAGS[0]]);
  noteService.getNotesByStoryId.mockResolvedValue(NOTES);
  storedRelations = [RELATION];
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('loading', () => {
  it('loads the tags and notes of the open story', async () => {
    const { result } = await render();

    expect(result.current.availableTags).toEqual(TAGS);
    expect(result.current.allNotes).toEqual(NOTES);
    expect(result.current.noteRelations).toEqual([RELATION]);
  });

  it('resolves the selected tags into full records for the detail screens', async () => {
    const { result } = await render();

    expect(result.current.selectedTagIds).toEqual(['t1']);
    expect(result.current.selectedTags).toEqual([TAGS[0]]);
  });

  /** Na criação a entidade ainda não existe; a seleção de tags fica só na memória. */
  it('loads the available tags but no selection while the entity has no id', async () => {
    const { result } = await renderHook(() =>
      useEntityRelations({ entityType: ENTITY_TYPE, entityId: undefined } as never),
    );

    await waitFor(() => expect(result.current.availableTags).toEqual(TAGS));
    expect(result.current.selectedTagIds).toEqual([]);
    expect(tagRelationService.getTagsForEntity).not.toHaveBeenCalled();
  });

  it('skips the note half entirely when the screen asked for tags only', async () => {
    const { result } = await renderHook(() =>
      useEntityRelations({ entityType: ENTITY_TYPE, entityId: ENTITY_ID, withNotes: false } as never),
    );

    await waitFor(() => expect(result.current.availableTags).toEqual(TAGS));
    expect(result.current.allNotes).toEqual([]);
    expect(noteService.getNotesByStoryId).not.toHaveBeenCalled();
    expect(noteRelationService.getRelationsForEntity).not.toHaveBeenCalled();
  });

  it('loads nothing without an open story', async () => {
    (useStoryStore as unknown as jest.Mock).mockReturnValue({ selectedStory: null });

    const { result } = await renderHook(() =>
      useEntityRelations({ entityType: ENTITY_TYPE, entityId: ENTITY_ID } as never),
    );

    expect(result.current.availableTags).toEqual([]);
    expect(tagService.getTagsByStoryId).not.toHaveBeenCalled();
  });

  it('survives a failure to load without blanking what it already had', async () => {
    const { result } = await render();
    tagService.getTagsByStoryId.mockRejectedValueOnce(new Error('banco fora'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.availableTags).toEqual(TAGS);
  });
});

describe('persisting the tag selection', () => {
  it('writes the current selection to the entity it was given', async () => {
    const { result } = await render();

    await act(async () => result.current.setSelectedTagIds(['t1', 't2']));
    await act(async () => {
      await result.current.persistTagRelations('rule-recem-criada');
    });

    expect(tagRelationService.updateTagsForEntity).toHaveBeenCalledWith(
      USER_ID,
      STORY_ID,
      'rule-recem-criada',
      ENTITY_TYPE,
      ['t1', 't2'],
    );
  });

  it('writes nothing without a target entity', async () => {
    const { result } = await render();

    await act(async () => {
      await result.current.persistTagRelations('');
    });

    expect(tagRelationService.updateTagsForEntity).not.toHaveBeenCalled();
  });

  it('writes nothing without a local user', async () => {
    (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: null });
    const { result } = await render();

    await act(async () => {
      await result.current.persistTagRelations(ENTITY_ID);
    });

    expect(tagRelationService.updateTagsForEntity).not.toHaveBeenCalled();
  });
});

describe('note relations', () => {
  it('adds a saved relation to the list', async () => {
    storedRelations = [];
    const { result } = await renderHook(() =>
      useEntityRelations({ entityType: ENTITY_TYPE, entityId: ENTITY_ID } as never),
    );
    await waitFor(() => expect(result.current.allNotes).toEqual(NOTES));

    await act(async () => {
      await result.current.saveNoteRelation({ noteId: 'n1' } as never);
    });

    expect(result.current.noteRelations).toEqual([RELATION]);
  });

  it('replaces a relation it already had instead of duplicating it', async () => {
    const { result } = await render();

    await act(async () => {
      await result.current.saveNoteRelation({ id: 'r1', noteId: 'n1' } as never);
    });

    expect(result.current.noteRelations).toEqual([RELATION]);
  });

  it('announces the change so the other screens follow', async () => {
    const listener = jest.fn();
    entityEventEmitter.on('note_relation_changed', listener);
    const { result } = await render();

    await act(async () => {
      await result.current.saveNoteRelation({ noteId: 'n1' } as never);
    });
    entityEventEmitter.off('note_relation_changed', listener);

    expect(listener).toHaveBeenCalledWith(STORY_ID, ENTITY_ID);
  });

  it('keeps the list untouched when the save fails', async () => {
    const { result } = await render();
    noteRelationService.saveNoteRelation.mockRejectedValueOnce(new Error('sem permissão'));

    await act(async () => {
      await result.current.saveNoteRelation({ noteId: 'n1' } as never);
    });

    expect(result.current.noteRelations).toEqual([RELATION]);
    expect(alert).toHaveBeenCalledWith('error', 'failed_to_save_note_relation');
  });

  it('drops a deleted relation from the list', async () => {
    const { result } = await render();

    await act(async () => {
      await result.current.deleteNoteRelation('r1');
    });

    expect(result.current.noteRelations).toEqual([]);
  });

  it('keeps the relation when the service refuses the delete', async () => {
    const { result } = await render();
    noteRelationService.deleteNoteRelation.mockImplementationOnce(async () => false);

    await act(async () => {
      await result.current.deleteNoteRelation('r1');
    });

    expect(result.current.noteRelations).toEqual([RELATION]);
    expect(alert).toHaveBeenCalledWith('error', 'failed_to_delete_note_relation');
  });

  it('keeps the relation when the delete blows up', async () => {
    const { result } = await render();
    noteRelationService.deleteNoteRelation.mockRejectedValueOnce(new Error('banco fora'));

    await act(async () => {
      await result.current.deleteNoteRelation('r1');
    });

    expect(result.current.noteRelations).toEqual([RELATION]);
  });

  it('refuses to write without a local user', async () => {
    (useUserSettingsStore as unknown as jest.Mock).mockReturnValue({ userId: null });
    const { result } = await render();

    await act(async () => {
      await result.current.saveNoteRelation({ noteId: 'n1' } as never);
    });

    expect(noteRelationService.saveNoteRelation).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalledWith('error', 'service_not_initialized');
  });
});

describe('reacting to changes elsewhere in the app', () => {
  it.each([
    ['note_changed', () => noteService.getNotesByStoryId],
    ['note_relation_changed', () => noteRelationService.getRelationsForEntity],
    ['tag_changed', () => tagService.getTagsByStoryId],
  ])('refreshes on %s for the open story', async (event, getSpy) => {
    await render();
    getSpy().mockClear();

    await act(async () => {
      entityEventEmitter.emit(event, STORY_ID);
    });

    expect(getSpy()).toHaveBeenCalled();
  });

  it.each(['note_changed', 'tag_changed'])('ignores %s from another story', async (event) => {
    await render();
    noteService.getNotesByStoryId.mockClear();
    tagService.getTagsByStoryId.mockClear();

    await act(async () => {
      entityEventEmitter.emit(event, 'outra-historia');
    });

    expect(noteService.getNotesByStoryId).not.toHaveBeenCalled();
    expect(tagService.getTagsByStoryId).not.toHaveBeenCalled();
  });

  /** O evento de tag carrega a entidade a que pertence; as das outras não interessam. */
  it('ignores a tag relation change that belongs to another entity', async () => {
    await render();
    tagRelationService.getTagsForEntity.mockClear();

    await act(async () => {
      entityEventEmitter.emit('tag_relation_changed', STORY_ID, 'outra-entidade');
    });

    expect(tagRelationService.getTagsForEntity).not.toHaveBeenCalled();
  });

  it('refreshes on a tag relation change with no entity attached', async () => {
    await render();
    tagRelationService.getTagsForEntity.mockClear();

    await act(async () => {
      entityEventEmitter.emit('tag_relation_changed', STORY_ID);
    });

    expect(tagRelationService.getTagsForEntity).toHaveBeenCalled();
  });

  it('does not subscribe to the note events when notes are off', async () => {
    await renderHook(() =>
      useEntityRelations({ entityType: ENTITY_TYPE, entityId: ENTITY_ID, withNotes: false } as never),
    );
    await waitFor(() => expect(tagService.getTagsByStoryId).toHaveBeenCalled());
    noteService.getNotesByStoryId.mockClear();

    await act(async () => {
      entityEventEmitter.emit('note_changed', STORY_ID);
    });

    expect(noteService.getNotesByStoryId).not.toHaveBeenCalled();
  });

  it('stops listening once the screen goes away', async () => {
    const { unmount } = await render();
    await unmount();
    tagService.getTagsByStoryId.mockClear();

    entityEventEmitter.emit('tag_changed', STORY_ID);

    expect(tagService.getTagsByStoryId).not.toHaveBeenCalled();
  });
});
