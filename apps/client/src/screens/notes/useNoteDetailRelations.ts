import { useMemo } from 'react';
import { useStoryEntities } from '@/src/hooks/lists/useStoryEntities';
import { useRelatedEntityGroups } from '@/src/hooks/relations/useRelatedEntityGroups';
import type { NoteDetailServices } from './useNoteDetailServices';

const TAG_RELATION_EVENTS = ['tag_relation_changed'] as const;
const NOTE_RELATION_EVENTS = ['note_relation_changed', 'note_changed'] as const;

/**
 * What the note detail shows about the note's surroundings: its tags, and the entities linked to it
 * grouped by kind.
 */
export function useNoteDetailRelations(
  { noteRelationService, tagRelationService }: NoteDetailServices,
  storyId: string | undefined,
  noteId: string,
) {
  const loadTags = useMemo(
    () => (id: string) => tagRelationService.getTagsForEntity(id, noteId, 'Note'),
    [tagRelationService, noteId],
  );
  const loadRelations = useMemo(
    () => (id: string) => noteRelationService.getRelationsForNote(id, noteId),
    [noteRelationService, noteId],
  );
  const tags = useStoryEntities({
    storyId,
    entityId: noteId,
    load: loadTags,
    events: TAG_RELATION_EVENTS,
    label: 'tags for note',
  });
  const relations = useStoryEntities({
    storyId,
    load: loadRelations,
    events: NOTE_RELATION_EVENTS,
    label: 'note relations',
  });

  return { tags, groupedEntities: useRelatedEntityGroups(storyId, relations) };
}
