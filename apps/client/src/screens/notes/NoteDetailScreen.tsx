import { createNoteRelationService } from '@/src/services/storymanagement/NoteRelationService';
import { Ionicons } from '@expo/vector-icons';
import { NoteRelation } from '@keres/shared/entities/Note'; // Import NoteRelation
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import EntityMetadata from '@/src/components/common/display/EntityMetadata/EntityMetadata';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import RelatedEntitiesList from '@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList';
import { ScreenError, ScreenLoading } from '@/src/components/common/feedback/ScreenState/ScreenState';
import TagChipList from '@/src/components/common/display/TagChipList/TagChipList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { NoteSelect } from '../../db/schemas/notes';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { EntityService } from '../../services/EntityService'; // Import EntityService
import { createNoteService } from '../../services/storymanagement/NoteService';
import { createTagRelationService } from '../../services/storymanagement/TagRelationService';
import { createTagService } from '../../services/storymanagement/TagService';
import { useStoryStore } from '../../state/storyStore'; // Import useStoryStore
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { NotesScreenNavigationProp } from './NoteListScreen';

// Define the parameter list for this screen
export type NoteDetailScreenParamList = {
  NoteDetail: { noteId: string };
};

type NoteDetailScreenRouteProp = RouteProp<NoteDetailScreenParamList, 'NoteDetail'>;

const NoteDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<NotesScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<NoteDetailScreenRouteProp>();
  const { noteId } = route.params;

  const drizzleDb = useDrizzle();
  const noteServiceRef = useRef<ReturnType<typeof createNoteService> | null>(null);
  const noteRelationServiceRef = useRef<ReturnType<typeof createNoteRelationService> | null>(null); // Added this line
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();
  const scrollBottomPadding = useFormScrollBottomPadding();

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
      if (!noteRelationServiceRef.current) {
        noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [note, setNote] = useState<NoteSelect | null>(null);
  const { canEdit } = useStoryRole(note?.storyId);
  const [noteTags, setNoteTags] = useState<TagSelect[]>([]);
  const [allNoteRelations, setAllNoteRelations] = useState<NoteRelation[]>([]);
  const [groupedEntities, setGroupedEntities] = useState<Record<string, string[]>>({
    character: [],
    worldrule: [],
    location: [],
    scene: [],
    chapter: [],
    choice: [],
    item: [],
    itemjourney: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = StyleSheet.create({
    mainTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
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
  }, [noteId, setNote, setLoading, setError, setHeaderTitle, navigation, t]);

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
  }, [note?.storyId, noteId]);

  const fetchNoteRelations = useCallback(async () => {
    if (!noteRelationServiceRef.current || !note?.storyId || !noteId) {
      console.warn('NoteRelationService or story not initialized for fetching relations.');
      return;
    }
    try {
      const relations = await noteRelationServiceRef.current.getRelationsForNote(note.storyId, noteId);
      setAllNoteRelations(relations);
    } catch (err) {
      console.error('Failed to fetch note relations:', err);
    }
  }, [note?.storyId, noteId]);

  const processNoteRelations = useCallback(async () => {
    if (!drizzleDb || !note?.storyId) return;

    const newGroupedEntities: Record<string, string[]> = {
      chapter: [],
      character: [],
      choice: [],
      item: [],
      itemjourney: [],
      location: [],
      note: [],
      operationlog: [],
      scene: [],
      story: [],
      suggestion: [],
      tag: [],
      user: [],
      worldrule: [],
      characterrelation: [],
      noterelation: [],
      tagrelation: [],
      characterscene: [],
    };

    for (const relation of allNoteRelations) {
      const entityName = await EntityService.getEntityIdentifier(drizzleDb, relation.relationType, relation.relationId, note.storyId, t);
      if (entityName) {
        newGroupedEntities[relation.relationType.toLowerCase()].push(entityName);
      }
    }
    setGroupedEntities(newGroupedEntities);
  }, [allNoteRelations, drizzleDb, note?.storyId, t]);

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
      fetchNoteRelations(); // Refetch relations if the note itself changed
    }
  }, [noteId, navigation, setNote, setHeaderTitle, t, fetchNoteRelations]);

  const handleNoteRelationChange = useCallback((changedStoryId: string, changedRelationId: string) => {
    // This event is emitted when any note_relation changes. We need to check if it affects *this* note.
    // However, for simplicity and ensuring data consistency, we'll refetch all relations for this note.
    // A more optimized approach would involve parsing changedRelationId if it contains noteId.
    fetchNoteRelations();
  }, [fetchNoteRelations]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === noteId) {
      fetchTagsForNote();
    }
  }, [noteId, fetchTagsForNote]);

  useEffect(() => {
    if (noteServiceRef.current && selectedStory?.id) { // Ensure selectedStory.id is available
      fetchNote();
      fetchNoteRelations(); // Fetch relations when the screen loads

      entityEventEmitter.on('note_changed', handleNoteChange);
      entityEventEmitter.on('note_relation_changed', handleNoteRelationChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);

      return () => {
        entityEventEmitter.off('note_changed', handleNoteChange);
        entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
      };
    }
  }, [noteId, fetchNote, handleNoteChange, handleTagRelationChange, selectedStory?.id, fetchNoteRelations, handleNoteRelationChange]); // Add selectedStory?.id and fetchNoteRelations to dependencies

  useEffect(() => {
    if (note) {
      fetchTagsForNote();
      processNoteRelations(); // Process relations after they are fetched
    }
  }, [note, fetchTagsForNote, processNoteRelations]);


  const renderHeaderRight = useCallback(() => (
    canEdit ? (
      <TouchableOpacity
        onPress={() => navigation.navigate('NoteForm', { noteId: noteId })}
        style={{ marginRight: 15 }}
      >
        <Ionicons name="pencil-outline" size={24} color={colors.text} />
      </TouchableOpacity>
    ) : null
  ), [navigation, noteId, colors.text, canEdit]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: headerTitle,
        headerRight: renderHeaderRight,
      });
      setDocumentTitle(headerTitle);
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading_note_details')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!note) {
    return <ScreenError padded message={t('note_data_missing')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
      <TagChipList tags={noteTags} />

      <DetailField label={t('body')} value={note.body || t('common_na')} />

      <CustomAttributeDetailFields storyId={note.storyId} entityType="Note" entityId={noteId} />

      <DetailField label={t('extra_notes')} value={note.extraNotes || t('common_na')} />

      <Text style={styles.sectionTitle}>{t('media_section_title')}</Text>
      <EntityGalleryManager
        ownerId={noteId}
        ownerType="Note"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
      />

      <RelatedEntitiesList
        title={t('related_entities_title')}
        noItemsMessage={t('no_entities_related')}
        groupedEntities={groupedEntities}
      />

      <EntityMetadata version={note.version} createdAt={note.createdAt} updatedAt={note.updatedAt} />
      <FavoritedByList storyId={note.storyId} entityId={noteId} entityType="Note" />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default NoteDetailScreen;
