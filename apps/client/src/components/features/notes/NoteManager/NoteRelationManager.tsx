import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance } from '@keres/shared';
import type { Note, NoteRelation, NoteRelationEntities } from '@keres/shared/entities/Note';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CollapsibleCard from '@/src/components/common/display/CollapsibleCard/CollapsibleCard';
import MultiSelectPill from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import { useTheme } from '../../../../theme';
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
  const { colors } = useTheme();
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

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLast: { borderBottomWidth: 0 },
    icon: { marginRight: 10 },
    name: { flex: 1, fontSize: 15, color: colors.text },
    empty: { color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 8 },
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modal: { width: '90%', backgroundColor: colors.background, borderRadius: 10, padding: 20 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
    modalBody: { fontSize: 16, color: colors.text, marginBottom: 20, maxHeight: '70%' },
    close: { alignSelf: 'flex-end', padding: 10, borderRadius: 5, backgroundColor: colors.primary },
    closeText: { color: colors.onPrimary, fontWeight: 'bold' },
  });
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
        {noteRelations.length === 0 ? (
          <Text style={styles.empty}>{t('no_notes_assigned')}</Text>
        ) : (
          noteRelations.map((relation, index) => {
            const note = byId.get(relation.noteId);
            const content = (
              <>
                <Ionicons name="document" size={20} color={noteColor} style={styles.icon} />
                <Text style={styles.name} numberOfLines={1}>
                  {note?.title || relation.noteId}
                </Text>
                {!editable && (
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                )}
              </>
            );
            const style = [styles.row, index === noteRelations.length - 1 && styles.rowLast];
            return editable ? (
              <View key={relation.id} style={style}>
                {content}
              </View>
            ) : (
              <TouchableOpacity
                key={relation.id}
                style={style}
                onPress={() => note && setOpenedNote(note)}
              >
                {content}
              </TouchableOpacity>
            );
          })
        )}
      </CollapsibleCard>
      {openedNote && (
        <Modal animationType="fade" transparent visible onRequestClose={() => setOpenedNote(null)}>
          <Pressable style={styles.overlay} onPress={() => setOpenedNote(null)}>
            <Pressable style={styles.modal} onPress={(event) => event.stopPropagation()}>
              <Text style={styles.modalTitle}>{openedNote.title}</Text>
              <Text style={styles.modalBody}>{openedNote.body}</Text>
              <TouchableOpacity onPress={() => setOpenedNote(null)} style={styles.close}>
                <Text style={styles.closeText}>{t('close')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
};

export default NoteRelationManager;
