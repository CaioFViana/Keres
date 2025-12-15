import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { NoteSelect } from '../../db/schemas/notes';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createNoteService } from '../../services/NoteService';
import { createTagService } from '../../services/TagService';
import { createTagRelationService } from '../../services/TagRelationService';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { NotesScreenNavigationProp } from './NoteListScreen';

// Define the parameter list for this screen
export type NoteDetailScreenParamList = {
  NoteDetail: { noteId: string };
};

type NoteDetailScreenRouteProp = RouteProp<NoteDetailScreenParamList, 'NoteDetail'>;

const NoteDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const route = useRoute<NoteDetailScreenRouteProp>();
  const { noteId } = route.params;

  const drizzleDb = useDrizzle();
  const noteServiceRef = useRef<ReturnType<typeof createNoteService> | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);
  const { t } = useTranslation();

  // Initialize services only once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!noteServiceRef.current) {
        noteServiceRef.current = createNoteService(drizzleDb);
      }
      if (!tagServiceRef.current) {
        tagServiceRef.current = createTagService(drizzleDb);
      }
      if (!tagRelationServiceRef.current) {
        tagRelationServiceRef.current = createTagRelationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [note, setNote] = useState<NoteSelect | null>(null);
  const [noteTags, setNoteTags] = useState<TagSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    subTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 15,
    },
    detailText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
    },
    errorText: {
      color: colors.error,
    },
    buttonContainer: {
      marginTop: 20,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 15,
      marginBottom: 5,
    },
  });

  const fetchNote = useCallback(async () => {
    if (!noteServiceRef.current) {
      console.warn('Note service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedNote = await noteServiceRef.current.getById(noteId);
      if (fetchedNote && !fetchedNote.isDeleted) {
        setNote(fetchedNote);
        setHeaderTitle(fetchedNote.title || t('note_details_title'));
      } else if (fetchedNote && fetchedNote.isDeleted) {
        navigation.goBack()
      }
      else {
        setError(t('note_not_found'));
        setHeaderTitle(t('note_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch note details:', err);
      setError(t('failed_to_load_note'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [noteId, setNote, setLoading, setError, setHeaderTitle, navigation, noteServiceRef.current, t]);

  const fetchTagsForNote = useCallback(async () => {
    if (!tagRelationServiceRef.current || !note?.storyId || !noteId) {
      setNoteTags([]);
      return;
    }
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(note.storyId, noteId, 'Note');
      setNoteTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch tags for note:', err);
    }
  }, [note?.storyId, noteId, tagRelationServiceRef.current]);

  const handleNoteChange = useCallback(async (changedStoryId: string, changedNoteId: string) => {
    if (changedNoteId === noteId) {
      if (noteServiceRef.current) {
        const updatedNote = await noteServiceRef.current.getById(noteId);
        if (!updatedNote || updatedNote.isDeleted) {
          navigation.goBack();
        } else {
          setNote(updatedNote);
          setHeaderTitle(updatedNote.title || t('note_details_title'));
        }
      }
    }
  }, [noteId, navigation, setNote, setHeaderTitle, noteServiceRef.current, t]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === noteId) {
      fetchTagsForNote();
    }
  }, [noteId, fetchTagsForNote]);

  useEffect(() => {
    if (noteServiceRef.current) {
      fetchNote();
      entityEventEmitter.on('note_changed', handleNoteChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);

      return () => {
        entityEventEmitter.off('note_changed', handleNoteChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
      };
    }
  }, [noteId, fetchNote, handleNoteChange, handleTagRelationChange, noteServiceRef.current]);

  useEffect(() => {
    if (note) {
      fetchTagsForNote();
    }
  }, [note, fetchTagsForNote]);


  const renderHeaderRight = useCallback(() => (
    <TouchableOpacity
      onPress={() => navigation.navigate('NoteForm', { noteId: noteId })}
      style={{ marginRight: 15 }}
    >
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, noteId, colors.text]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: headerTitle,
        headerRight: renderHeaderRight,
      });
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_note_details')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!note) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{t('note_data_missing')}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.mainTitle}>{note.title}</Text>
      
      {note.body && (
        <Text style={styles.detailText}>{t('body')}: {note.body}</Text>
      )}

      {note.extraNotes && (
        <Text style={styles.detailText}>{t('extra_notes')}: {note.extraNotes}</Text>
      )}

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={noteTags} />
      
      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </View>
  );
};

export default NoteDetailScreen;
