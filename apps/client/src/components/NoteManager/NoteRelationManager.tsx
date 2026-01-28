import { Note, NoteRelation, NoteRelationEntities } from '@keres/shared/entities/Note';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme';
import { createULID } from '../../utils/entityUtils';
import RelationManager from '../RelationManager/RelationManager';

interface NoteRelationManagerProps {
  noteRelations: NoteRelation[];
  availableNotes: Note[]; // All available notes to choose from
  onSave: (relation: NoteRelation) => Promise<void>;
  onDelete: (relationId: string) => Promise<void>;
  editable: boolean;
  currentStoryId: string;
  currentEntityId: string; // The ID of the character, location, etc. this note is related to
  currentEntityType: NoteRelationEntities; // 'Character', 'Location', 'Scene', etc.
}

const NoteRelationManager: React.FC<NoteRelationManagerProps> = ({
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

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedNoteContent, setSelectedNoteContent] = useState<Note | null>(null);

  const createNoteRelationObject = (selectedNoteId: string, storyId: string, relationId: string): NoteRelation => {
    return {
      id: createULID(),
      storyId: storyId,
      noteId: selectedNoteId,
      relationId: relationId,
      relationType: currentEntityType, // This comes from parent component
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };
  };

  const getNoteIdFromRelation = (relation: NoteRelation) => relation.noteId;

  const getNoteName = (note: Note) => note.title;

  const getNoteSearchableName = (note: Note) => note.title;

  const filterAvailableNotes = (note: Note, relations: NoteRelation[], getRelationItemId: (relation: NoteRelation) => string) => {
    return !note.isDeleted && !relations.some(rel => getRelationItemId(rel) === note.id);
  };

  const handleNotePress = useCallback((note: Note) => {
    setSelectedNoteContent(note);
    setNoteModalVisible(true);
  }, []);

  const renderNoteRelationExtraContent = useCallback((relation: NoteRelation, availableItems: Note[]) => {
    const note = availableItems.find(n => n.id === relation.noteId);
    if (!note) return null;
    return (
      <TouchableOpacity style={{ flex: 1, paddingVertical: 10 }} onPress={() => handleNotePress(note)}>
        <Text style={{ fontSize: 16, color: colors.text }}>{note.title}</Text>
      </TouchableOpacity>
    );
  }, [handleNotePress, colors.text]);

  const modalStyles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      width: '90%',
      backgroundColor: colors.background,
      borderRadius: 10,
      padding: 20,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    modalBody: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 20,
      maxHeight: '70%', // Limit height for scrollability
    },
    closeButton: {
      alignSelf: 'flex-end',
      padding: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    closeButtonText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
    },
  });


  return (
    <>
      <RelationManager<Note, NoteRelation>
        relations={noteRelations}
        availableItems={availableNotes}
        onSave={onSave}
        onDelete={onDelete}
        editable={editable}
        currentStoryId={currentStoryId}
        currentEntityId={currentEntityId}
        createRelationObject={createNoteRelationObject}
        getRelationItemId={getNoteIdFromRelation}
        getItemDisplayName={getNoteName}
        getItemSearchValue={getNoteSearchableName}
        filterAvailableItems={filterAvailableNotes}
        selectItemPlaceholder={t('select_note')}
        noItemsAssignedMessage={t('no_notes_assigned')}
        itemAlreadyAddedMessage={t('note_already_added')}
        selectItemToAddMessage={t('select_note_to_add')}
        deleteConfirmationTitle={t('delete_note_relation_title')}
        deleteConfirmationMessage={t('delete_note_relation_message')}
        renderRelationItemExtraContent={(relation, items) => {
          const note = items.find(n => n.id === relation.noteId);
          if (!note) return null;
          return (
            <TouchableOpacity style={{ flex: 1, paddingVertical: 10 }} onPress={() => handleNotePress(note)}>
              <Text style={{ fontSize: 16, color: colors.text }}>{note.title}</Text>
            </TouchableOpacity>
          );
        }}
        title={t('notes_title')}
      />

      {noteModalVisible && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={noteModalVisible}
          onRequestClose={() => setNoteModalVisible(false)}
        >
          <Pressable style={modalStyles.modalOverlay} onPress={() => setNoteModalVisible(false)}>
            <Pressable style={modalStyles.modalContent} onPress={(e) => e.stopPropagation()}>
              <Text style={modalStyles.modalTitle}>{selectedNoteContent?.title}</Text>
              <Text style={modalStyles.modalBody}>{selectedNoteContent?.body}</Text>
              <TouchableOpacity
                onPress={() => setNoteModalVisible(false)}
                style={modalStyles.closeButton}
              >
                <Text style={modalStyles.closeButtonText}>{t('close')}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
};

export default NoteRelationManager;