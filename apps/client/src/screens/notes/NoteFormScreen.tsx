import { Note } from '@keres/shared/entities/Note';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import MultiSelectPill from '../../components/common/MultiSelectPill/MultiSelectPill';
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { NotesStackParamList } from '../../navigation/MainSystemStack';
import { createNoteService } from '../../services/storymanagement/NoteService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';

type NoteFormScreenRouteProp = RouteProp<NotesStackParamList, 'NoteForm'>;

const NoteFormScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<NoteFormScreenRouteProp>();
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore()
  const { noteId } = route.params || {};
  const { selectedStory } = useStoryStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const noteService = useCallback(() => createNoteService(drizzleDb), [drizzleDb]);
  const confirmDelete = useConfirmDelete();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  // Notes can't be attached to other notes, so only the tag half of the hook applies.
  const {
    availableTags,
    selectedTagIds,
    setSelectedTagIds,
    persistTagRelations,
  } = useEntityRelations({ entityType: 'Note', entityId: noteId, withNotes: false });

  const [loading, setLoading] = useState(true);

  const isEditing = !!noteId;

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_note_title') : t('create_note_title'),
        headerRight: () => <View/>
      });
    }, [navigation, isEditing, t])
  );

  useEffect(() => {
    const loadNote = async () => {
      if (!isEditing) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const fetchedNote = await noteService().getById(noteId!);
        if (fetchedNote) {
          setTitle(fetchedNote.title);
          setBody(fetchedNote.body);
          setIsFavorite(fetchedNote.isFavorite);
          setExtraNotes(fetchedNote.extraNotes);
        } else {
          console.warn('Note not found:', noteId);
        }
      } catch (err) {
        console.error('Failed to load note:', err);
      } finally {
        setLoading(false);
      }
    };
    loadNote();
  }, [noteId, isEditing, noteService, t]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(t('error'), t('note_title_required'));
      return;
    }
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!selectedStory?.id) {
      Alert.alert(t('error'), t('no_story_selected'));
      return;
    }

    setLoading(true);

    try {
      const noteData: Omit<Note, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = {
        title: title.trim(),
        body: body,
        isFavorite: isFavorite,
        extraNotes: extraNotes,
      };

      let currentNoteId = noteId;

      if (isEditing) {
        await noteService().updateNote(userId, noteId!, noteData);
        Alert.alert(t('success'), t('note_updated_successfully'));
      } else {
        const newNote = await noteService().createNote(userId, { ...noteData, storyId: selectedStory.id });
        Alert.alert(t('success'), t('note_created_successfully'));
        currentNoteId = newNote.id; // Get the ID of the newly created note
      }

      if (currentNoteId) {
        await persistTagRelations(currentNoteId);
      }

      navigation.goBack();
    } catch (err) {
      console.error('Failed to save note:', err);
      Alert.alert(t('error'), t('failed_to_save_note'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!noteId) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_note_title',
      messageKey: 'delete_note_message',
      successKey: 'note_deleted_successfully',
      failureKey: 'failed_to_delete_note',
      onLoadingChange: setLoading,
      onConfirm: async () => {
        await noteService().deleteNote(userId, noteId);
        navigation.goBack();
      },
    });
  };

  const handleTagSelectionChange = useCallback((newSelection: string[]) => {
    setSelectedTagIds(newSelection);
  }, [setSelectedTagIds]);

  const styles = StyleSheet.create({
    scrollViewContent: {
      padding: 20,
      paddingBottom: 350,
      flexGrow: 1,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 5,
    },
    label: {
      fontSize: 16,
      fontWeight: 'bold',
      marginTop: 15,
      marginBottom: 5,
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 15,
      marginBottom: 5,
    },
    saveButton: {
      marginTop: 20,
      marginBottom: 0,
    },
    deleteButton: {
      backgroundColor: 'red',
      marginBottom: 15
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    tagSection: {
      marginTop: 20,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.text }}>{t('loading')}...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_note_title') : t('create_note_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('note_form_description')}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('title')}</Text>
          <TextInput
            placeholder={t('title_placeholder')}
            value={title}
            onChangeText={setTitle}
            style={commonInputStyles.input}
          />

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5 }]}>{t('is_favorite')}</Text>
            <Switch
              value={isFavorite}
              onValueChange={setIsFavorite}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isFavorite ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('body')}</Text>
          <TextInput
            placeholder={t('body_placeholder')}
            value={body || ""}
            onChangeText={setBody}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
          />
          
          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ""}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
          />

          <View style={styles.tagSection}>
            <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
            <MultiSelectPill
              options={availableTags.map(tag => ({ label: tag.name, value: tag.id, color: tag.color || colors.primaryContainer }))}
              selectedValues={selectedTagIds}
              onSelectionChange={handleTagSelectionChange}
              placeholder={t('select_tags_for_note')}
              label={t('note_tags')}
            />
          </View>

          <Button onPress={handleSave} style={styles.saveButton}>
            {isEditing ? t('save_changes') : t('create_note')}
          </Button>

          {isEditing && (
            <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
              {t('delete_note_title')}
            </Button>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default NoteFormScreen;
