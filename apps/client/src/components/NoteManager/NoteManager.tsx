import { Ionicons } from '@expo/vector-icons';
import { Note, NoteRelation, NoteRelationEntities } from '@keres/shared/entities/Note';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native'; // Removed FlatList
import Select from '../common/Select/Select';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { createULID } from '../../utils/ulid';

type SelectOption = { label: string; value: string; color?: string }; // Local type definition

interface NoteManagerProps {
  noteRelations: NoteRelation[];
  availableNotes: Note[]; // All available notes to choose from
  onSave: (relation: NoteRelation) => Promise<void>;
  onDelete: (relationId: string) => Promise<void>;
  editable: boolean;
  currentStoryId: string;
  currentEntityId: string; // The ID of the character, location, etc. this note is related to
  currentEntityType: NoteRelationEntities; // 'Character', 'Location', 'Scene', etc.
}

const NoteManager: React.FC<NoteManagerProps> = ({
  noteRelations,
  availableNotes,
  onSave,
  onDelete,
  editable,
  currentStoryId,
  currentEntityId,
  currentEntityType,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const commonInputStyles = getCommonInputStyles(colors);

  const [selectedNoteIdToAdd, setSelectedNoteIdToAdd] = useState<string | null>(null);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [selectedNoteContent, setSelectedNoteContent] = useState<Note | null>(null);

  const styles = StyleSheet.create({
    container: {
      marginTop: 10,
    },
    relationItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 15,
      backgroundColor: colors.surface,
      borderRadius: 8,
      marginBottom: 8,
    },
    relationText: {
      fontSize: 16,
      color: colors.text,
      flex: 1,
    },
    deleteButton: {
      marginLeft: 10,
      padding: 5,
    },
    addRelationContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 15,
      marginBottom: 10,
    },
    dropdown: {
      flex: 1,
      marginRight: 10,
    },
    addButton: {
      padding: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    addButtonText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
    },
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

  const handleAddNoteRelation = useCallback(async () => {
    if (!selectedNoteIdToAdd) {
      Alert.alert(t('error'), t('select_note_to_add'));
      return;
    }

    const noteExists = noteRelations.some(rel => rel.noteId === selectedNoteIdToAdd);
    if (noteExists) {
      Alert.alert(t('error'), t('note_already_added'));
      return;
    }

    const newRelation: NoteRelation = {
      id: createULID(),
      storyId: currentStoryId,
      noteId: selectedNoteIdToAdd,
      relationId: currentEntityId,
      relationType: currentEntityType,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
      isDeleted: false,
      deletedAt: null,
    };

    await onSave(newRelation);
    setSelectedNoteIdToAdd(null);
  }, [selectedNoteIdToAdd, noteRelations, currentStoryId, currentEntityId, currentEntityType, onSave, t]);

  const handleDeleteNoteRelation = useCallback(async (relationId: string) => {
    Alert.alert(
      t('delete_note_relation_title'),
      t('delete_note_relation_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          onPress: async () => {
            await onDelete(relationId);
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  }, [onDelete, t]);

  const handleNotePress = useCallback((note: Note) => {
    setSelectedNoteContent(note);
    setNoteModalVisible(true);
  }, []);

  const availableNoteOptions: SelectOption[] = availableNotes
    .filter(note => !noteRelations.some(rel => rel.noteId === note.id)) // Filter out already related notes
    .map(note => ({
      label: note.title,
      value: note.id,
      color: colors.primaryContainer, // Or a specific color for notes
    }));

  const renderNoteRelationItem = (item: NoteRelation) => { // Modified to accept single item
    const note = availableNotes.find(n => n.id === item.noteId);
    if (!note) return null; // Should not happen if data is consistent

    return (
      <View key={item.id} style={styles.relationItem}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => handleNotePress(note)}>
          <Text style={styles.relationText}>{note.title}</Text>
        </TouchableOpacity>
        {editable && (
          <TouchableOpacity onPress={() => handleDeleteNoteRelation(item.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={24} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {noteRelations.length === 0 ? (
        <Text style={{ color: colors.textSecondary }}>{t('no_notes_assigned')}</Text>
      ) : (
        <View>
          {noteRelations.map(renderNoteRelationItem)}
        </View>
      )}

      {editable && (
        <View style={styles.addRelationContainer}>
          <View style={styles.dropdown}>
            <Select
              options={availableNoteOptions}
              value={selectedNoteIdToAdd}
              onValueChange={(value: string | null) => setSelectedNoteIdToAdd(value)}
              placeholder={t('select_note')}
              multiple={false}
            />
          </View>
          <TouchableOpacity onPress={handleAddNoteRelation} style={styles.addButton}>
            <Text style={styles.addButtonText}>{t('add')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {noteModalVisible && (
          <Modal
            animationType="fade"
            transparent={true}
            visible={noteModalVisible}
            onRequestClose={() => setNoteModalVisible(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setNoteModalVisible(false)}>
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                <Text style={styles.modalTitle}>{selectedNoteContent?.title}</Text>
                <Text style={styles.modalBody}>{selectedNoteContent?.body}</Text>
                <TouchableOpacity
                  onPress={() => setNoteModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Text style={styles.closeButtonText}>{t('close')}</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </Modal>
      )}
    </View>
  );
};

export default NoteManager;