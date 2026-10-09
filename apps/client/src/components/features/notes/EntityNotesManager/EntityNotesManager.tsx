import NoteManager from '@/src/components/features/notes/NoteManager';
import type { Note, NoteRelation, NoteRelationEntities } from '@keres/shared/entities/Note';

interface EntityNotesManagerProps {
  noteRelations: NoteRelation[];
  availableNotes: Note[];
  onSave: (relation: NoteRelation) => Promise<void>;
  onDelete: (relationId: string) => Promise<void>;
  /** The entity the notes are attached to. */
  target: { storyId: string; entityType: NoteRelationEntities; entityId: string };
}

/** The notes section of an entity form: the notes linked to this entity, editable in place. */
export default function EntityNotesManager({
  noteRelations,
  availableNotes,
  onSave,
  onDelete,
  target,
}: EntityNotesManagerProps) {
  return (
    <NoteManager
      noteRelations={noteRelations}
      availableNotes={availableNotes}
      onSave={onSave}
      onDelete={onDelete}
      editable={true}
      currentStoryId={target.storyId}
      currentEntityId={target.entityId}
      currentEntityType={target.entityType}
    />
  );
}
