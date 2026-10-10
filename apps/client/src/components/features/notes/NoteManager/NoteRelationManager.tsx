import { getEntityAppearance } from '@keres/shared';
import type { Note, NoteRelation, NoteRelationEntities } from '@keres/shared/entities/Note';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import EntityRelationList from '@/src/components/common/display/EntityRelationList/EntityRelationList';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import ModalHeader from '@/src/components/layout/ModalHeader/ModalHeader';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import type { ThemeColors } from '../../../../theme';
import { useThemedStyles } from '../../../../theme/useThemedStyles';
import { typography } from '../../../../theme/tokens';
import { createULID } from '../../../../utils/entityUtils';

interface Props {
  noteRelations: NoteRelation[];
  availableNotes: Note[];
  onSave: (relation: NoteRelation) => Promise<void>;
  onDelete: (relationId: string) => Promise<void>;
  editable: boolean;
  currentStoryId: string;
  currentEntityId: string;
  currentEntityType: NoteRelationEntities;
}

/** Notes retain their own section, while using the common picker interaction. */
const NoteRelationManager: React.FC<Props> = ({
  noteRelations,
  availableNotes,
  onSave,
  onDelete,
  editable,
  currentStoryId,
  currentEntityId,
  currentEntityType,
}) => {
  const { t } = useTranslation();
  const [openedNote, setOpenedNote] = useState<Note | null>(null);
  const notes = useMemo(() => availableNotes.filter((note) => !note.isDeleted), [availableNotes]);
  const byId = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes]);
  const selectedValues = useMemo(
    () => noteRelations.map((relation) => relation.noteId),
    [noteRelations],
  );
  const noteColor = getEntityAppearance('Note').color;

  const changeSelection = useCallback(
    async (ids: string[]) => {
      const selected = new Set(ids);
      const existing = new Set(noteRelations.map((relation) => relation.noteId));
      for (const relation of noteRelations)
        if (!selected.has(relation.noteId)) await onDelete(relation.id);
      for (const noteId of ids)
        if (!existing.has(noteId))
          await onSave({
            id: createULID(),
            storyId: currentStoryId,
            noteId,
            relationId: currentEntityId,
            relationType: currentEntityType,
            createdAt: new Date(),
            updatedAt: new Date(),
            version: 1,
            isDeleted: false,
            deletedAt: null,
          });
    },
    [currentEntityId, currentEntityType, currentStoryId, noteRelations, onDelete, onSave],
  );

  const styles = useThemedStyles(createStyles);
  return (
    <>
      <CollapsibleCard
        title={`${t('notes_title')} (${noteRelations.length})`}
        initialExpanded={false}
      >
        {editable && (
          <MultiSelectPill
            options={notes.map((note) => ({ label: note.title, value: note.id, color: noteColor }))}
            selectedValues={selectedValues}
            onSelectionChange={(ids) => void changeSelection(ids)}
            placeholder={t('select_note')}
            noOptionsText={t('no_notes_assigned')}
          />
        )}
        <EntityRelationList
          emptyText={t('no_notes_assigned')}
          items={noteRelations.map((relation) => {
            const note = byId.get(relation.noteId);
            return {
              id: relation.id,
              title: note?.title || relation.noteId,
              icon: 'document',
              color: noteColor,
              onPress: editable ? undefined : () => note && setOpenedNote(note),
            };
          })}
        />
      </CollapsibleCard>
      <ResponsiveModal visible={!!openedNote} onClose={() => setOpenedNote(null)} inset="regular">
        <ModalHeader title={openedNote?.title ?? ''} onClose={() => setOpenedNote(null)} />
        <ScrollView>
          <Text style={styles.modalBody}>{openedNote?.body}</Text>
        </ScrollView>
      </ResponsiveModal>
    </>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalBody: { ...typography.bodyLarge, color: colors.text },
  });

export default NoteRelationManager;
