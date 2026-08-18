import { Note, NoteRelation, NoteRelationEntities } from '@keres/shared/entities/Note';
import { TagRelationEntities } from '@keres/shared/entities/Tag';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../db';
import { TagSelect } from '../db/schema';
import {
  createNoteRelationService,
  SaveNoteRelation,
} from '../services/storymanagement/NoteRelationService';
import { createNoteService } from '../services/storymanagement/NoteService';
import { createTagRelationService } from '../services/storymanagement/TagRelationService';
import { createTagService } from '../services/storymanagement/TagService';
import { useStoryStore } from '../state/storyStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { createULID } from '../utils/entityUtils';
import { entityEventEmitter } from '../utils/EventEmitter';
import { AppAlert } from '../utils/AppAlert';

export interface UseEntityRelationsOptions {
  /** The entity these relations hang off, e.g. `'WorldRule'`. */
  entityType: TagRelationEntities;
  /** Undefined while creating - tag selections are held locally until the entity exists. */
  entityId: string | undefined;
  /**
   * Notes cannot be attached to other notes, so `NoteFormScreen` passes false and gets
   * only the tag half of the hook.
   */
  withNotes?: boolean;
}

/**
 * Tag and note relation wiring for an entity's form and detail screens.
 *
 * Every entity screen used to repeat this by hand: five service refs, an init effect,
 * four fetch callbacks, the tag persist call on save, and the note relation
 * save/delete handlers with their alerts and change events - around 120 lines per
 * screen, across nineteen screens, differing only in the entity name.
 */
export function useEntityRelations({
  entityType,
  entityId,
  withNotes = true,
}: UseEntityRelationsOptions) {
  const drizzleDb = useDrizzle();
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const storyId = selectedStory?.id;

  // Services are cheap factories over a stable db handle, so a memo replaces the
  // ref-plus-init-effect dance the screens were doing.
  const services = useMemo(() => {
    if (!drizzleDb) {
      return null;
    }
    return {
      tag: createTagService(drizzleDb),
      tagRelation: createTagRelationService(drizzleDb),
      note: createNoteService(drizzleDb),
      noteRelation: createNoteRelationService(drizzleDb),
    };
  }, [drizzleDb]);

  const [availableTags, setAvailableTags] = useState<TagSelect[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [noteRelations, setNoteRelations] = useState<NoteRelation[]>([]);
  // Enquanto `entityId` é undefined (criando), não há entidade real pra gravar a relação -
  // guardado aqui até `persistNoteRelations` ser chamado com o id de verdade depois do save.
  const [pendingNoteRelations, setPendingNoteRelations] = useState<NoteRelation[]>([]);

  const refreshAvailableTags = useCallback(async () => {
    if (!services || !storyId) {
      setAvailableTags([]);
      return;
    }
    try {
      setAvailableTags(await services.tag.getTagsByStoryId(storyId));
    } catch (err) {
      console.error('Failed to fetch available tags:', err);
    }
  }, [services, storyId]);

  const refreshSelectedTags = useCallback(async () => {
    if (!services || !storyId || !entityId) {
      setSelectedTagIds([]);
      return;
    }
    try {
      const tags = await services.tagRelation.getTagsForEntity(storyId, entityId, entityType);
      setSelectedTagIds(tags.map((tag) => tag.id));
    } catch (err) {
      console.error(`Failed to fetch tags for ${entityType}:`, err);
    }
  }, [services, storyId, entityId, entityType]);

  const refreshNotes = useCallback(async () => {
    if (!services || !storyId || !withNotes) {
      setAllNotes([]);
      return;
    }
    try {
      setAllNotes(await services.note.getNotesByStoryId(storyId));
    } catch (err) {
      console.error('Failed to fetch notes for story:', err);
    }
  }, [services, storyId, withNotes]);

  const refreshNoteRelations = useCallback(async () => {
    if (!services || !storyId || !entityId || !withNotes) {
      setNoteRelations([]);
      return;
    }
    try {
      const relations = await services.noteRelation.getRelationsForEntity(
        storyId,
        entityId,
        entityType as NoteRelationEntities,
      );
      setNoteRelations(relations);
    } catch (err) {
      console.error(`Failed to fetch note relations for ${entityType}:`, err);
    }
  }, [services, storyId, entityId, entityType, withNotes]);

  const refresh = useCallback(async () => {
    await Promise.all([
      refreshAvailableTags(),
      refreshSelectedTags(),
      refreshNotes(),
      refreshNoteRelations(),
    ]);
  }, [refreshAvailableTags, refreshSelectedTags, refreshNotes, refreshNoteRelations]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep tags and note pickers current when they change elsewhere in the app.
  useEffect(() => {
    const handleNoteChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) {
        refreshNotes();
      }
    };
    const handleNoteRelationChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) {
        refreshNoteRelations();
      }
    };
    const handleTagRelationChange = (changedStoryId: string, changedEntityId?: string) => {
      // Tag relation events carry the entity they belong to; ignore other entities'.
      if (changedStoryId === storyId && (!changedEntityId || changedEntityId === entityId)) {
        refreshSelectedTags();
      }
    };
    const handleTagChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) {
        refreshAvailableTags();
      }
    };

    if (withNotes) {
      entityEventEmitter.on('note_changed', handleNoteChange);
      entityEventEmitter.on('note_relation_changed', handleNoteRelationChange);
    }
    entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);
    entityEventEmitter.on('tag_changed', handleTagChange);

    return () => {
      if (withNotes) {
        entityEventEmitter.off('note_changed', handleNoteChange);
        entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
      }
      entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
      entityEventEmitter.off('tag_changed', handleTagChange);
    };
  }, [
    withNotes,
    storyId,
    entityId,
    refreshNotes,
    refreshNoteRelations,
    refreshSelectedTags,
    refreshAvailableTags,
  ]);

  /**
   * Writes the current tag selection to the entity. Takes an explicit id because on
   * create the entity only gets one after the save that precedes this call.
   */
  const persistTagRelations = useCallback(
    async (targetEntityId: string) => {
      if (!services || !storyId || !userId || !targetEntityId) {
        return;
      }
      await services.tagRelation.updateTagsForEntity(
        userId,
        storyId,
        targetEntityId,
        entityType,
        selectedTagIds,
      );
    },
    [services, storyId, userId, entityType, selectedTagIds],
  );

  const saveNoteRelation = useCallback(
    async (relation: SaveNoteRelation) => {
      if (!entityId) {
        // Ainda criando - guarda localmente com um id sintético só pra a UI (lista, key,
        // remover) funcionar igual; `relationId` de verdade só existe no replay.
        const draft: NoteRelation = {
          ...relation,
          id: `pending-${createULID()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
          isDeleted: false,
          deletedAt: null,
        };
        setPendingNoteRelations((prev) => [...prev, draft]);
        AppAlert.alert(t('success'), t('note_relation_saved_successfully'));
        return;
      }
      if (!services || !storyId || !userId) {
        AppAlert.alert(t('error'), t('service_not_initialized'));
        return;
      }
      try {
        const saved = await services.noteRelation.saveNoteRelation(userId, relation);
        setNoteRelations((prev) => {
          const index = prev.findIndex((r) => r.id === saved.id);
          return index > -1 ? prev.map((r, i) => (i === index ? saved : r)) : [...prev, saved];
        });
        entityEventEmitter.emit('note_relation_changed', storyId, entityId);
        AppAlert.alert(t('success'), t('note_relation_saved_successfully'));
      } catch (err) {
        console.error('Failed to save note relation:', err);
        AppAlert.alert(t('error'), t('failed_to_save_note_relation'));
      }
    },
    [services, storyId, userId, entityId, t],
  );

  const deleteNoteRelation = useCallback(
    async (relationId: string) => {
      if (!entityId) {
        setPendingNoteRelations((prev) => prev.filter((r) => r.id !== relationId));
        AppAlert.alert(t('success'), t('note_relation_deleted_successfully'));
        return;
      }
      if (!services || !storyId || !userId) {
        AppAlert.alert(t('error'), t('service_not_initialized'));
        return;
      }
      try {
        const success = await services.noteRelation.deleteNoteRelation(userId, relationId);
        if (!success) {
          AppAlert.alert(t('error'), t('failed_to_delete_note_relation'));
          return;
        }
        setNoteRelations((prev) => prev.filter((r) => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', storyId, entityId);
        AppAlert.alert(t('success'), t('note_relation_deleted_successfully'));
      } catch (err) {
        console.error('Failed to delete note relation:', err);
        AppAlert.alert(t('error'), t('failed_to_delete_note_relation'));
      }
    },
    [services, storyId, userId, entityId, t],
  );

  /**
   * Grava de verdade as relações de nota acumuladas enquanto a entidade ainda não existia.
   * Mesmo padrão de `persistTagRelations`: chamado pelo form logo depois do save principal,
   * com o id que só existe a partir dali.
   */
  const persistNoteRelations = useCallback(
    async (targetEntityId: string) => {
      if (!services || !storyId || !userId || pendingNoteRelations.length === 0) {
        return;
      }
      for (const pending of pendingNoteRelations) {
        await services.noteRelation.saveNoteRelation(userId, {
          storyId,
          noteId: pending.noteId,
          relationId: targetEntityId,
          relationType: pending.relationType,
        });
      }
      setPendingNoteRelations([]);
      entityEventEmitter.emit('note_relation_changed', storyId, targetEntityId);
    },
    [services, storyId, userId, pendingNoteRelations],
  );

  /**
   * The selected tags as full records. Detail screens render tag chips (name, colour)
   * rather than editing a selection, so ids alone aren't enough for them.
   */
  const selectedTags = useMemo(
    () => availableTags.filter((tag) => selectedTagIds.includes(tag.id)),
    [availableTags, selectedTagIds],
  );

  return {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    selectedTags,
    allNotes,
    // Sem entidade ainda, `noteRelations` fetched fica sempre vazia - mostra o buffer local
    // no lugar, transparente pra quem consome (NoteRelationManager não sabe a diferença).
    noteRelations: entityId ? noteRelations : pendingNoteRelations,
    persistTagRelations,
    saveNoteRelation,
    deleteNoteRelation,
    persistNoteRelations,
    refresh,
    refreshNotes,
    refreshNoteRelations,
  };
}
