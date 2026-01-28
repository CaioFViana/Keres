import ChapterSceneManager from '@/src/components/ChapterManager/ChapterSceneManager'; // Import ChapterSceneManager
import NoteManager from '@/src/components/NoteManager';
import TagChipList from '@/src/components/common/TagChipList/TagChipList'; // Import TagChipList
import { useDrizzle } from '@/src/db';
import { ChapterSelect, SceneSelect, TagSelect } from '@/src/db/schema'; // Import SceneSelect
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { createChapterService } from '@/src/services/storymanagement/ChapterService';
import { createLocationService, LocationService } from '@/src/services/storymanagement/LocationService'; // Import LocationService
import { createNoteRelationService, NoteRelationServiceInterface } from '@/src/services/storymanagement/NoteRelationService';
import { createNoteService, NoteService } from '@/src/services/storymanagement/NoteService';
import { createSceneService, SceneService } from '@/src/services/storymanagement/SceneService'; // Import SceneService
import { createTagRelationService } from '@/src/services/storymanagement/TagRelationService'; // Import TagRelationService
import { createTagService } from '@/src/services/storymanagement/TagService'; // Import TagService
import { useStoryStore } from '@/src/state/storyStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';
import { entityEventEmitter } from '@/src/utils/EventEmitter';
import { Ionicons } from '@expo/vector-icons';
import { Location } from '@keres/shared/entities/Location'; // Import Location entity
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChaptersScreenNavigationProp } from './ChapterListScreen';

// Define the parameter list for this screen
export type ChapterDetailScreenParamList = {
  ChapterDetail: { chapterId: string };
};

type ChapterDetailScreenRouteProp = RouteProp<ChapterDetailScreenParamList, 'ChapterDetail'>;

const ChapterDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<ChaptersScreenNavigationProp>();
  const route = useRoute<ChapterDetailScreenRouteProp>();
  const { chapterId } = route.params;
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const chapterServiceRef = useRef<ReturnType<typeof createChapterService> | null>(null);
  const noteServiceRef = useRef<NoteService | null>(null);
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null); // Ref for TagService
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null); // Ref for TagRelationService
  const sceneServiceRef = useRef<SceneService | null>(null); // Ref for SceneService
  const locationServiceRef = useRef<LocationService | null>(null); // Ref for LocationService

  // Initialize services once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!chapterServiceRef.current) {
        chapterServiceRef.current = createChapterService(drizzleDb);
      }
      if (!noteServiceRef.current) {
        noteServiceRef.current = createNoteService(drizzleDb);
      }
      if (!noteRelationServiceRef.current) {
        noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      }
      if (!tagServiceRef.current) {
        tagServiceRef.current = createTagService(drizzleDb);
      }
      if (!tagRelationServiceRef.current) {
        tagRelationServiceRef.current = createTagRelationService(drizzleDb);
      }
      if (!sceneServiceRef.current) {
        sceneServiceRef.current = createSceneService(drizzleDb);
      }
      if (!locationServiceRef.current) {
        locationServiceRef.current = createLocationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [chapter, setChapter] = useState<ChapterSelect | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [chapterNoteRelations, setChapterNoteRelations] = useState<NoteRelation[]>([]);
  const [chapterTags, setChapterTags] = useState<TagSelect[]>([]); // State for chapter-specific tags
  const [allScenes, setAllScenes] = useState<SceneSelect[]>([]); // State for for all scenes in story
  const [allLocations, setAllLocations] = useState<Location[]>([]); // State for all locations in story
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

  const fetchChapter = useCallback(async () => {
    if (!chapterServiceRef.current) {
      console.warn('Chapter service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedChapter = await chapterServiceRef.current.getById(chapterId);
      if (fetchedChapter && !fetchedChapter.isDeleted) {
        setChapter(fetchedChapter);
        setHeaderTitle(fetchedChapter.name || t('chapter_details_title'));
      } else if (fetchedChapter && fetchedChapter.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('chapter_not_found'));
        setHeaderTitle(t('chapter_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch chapter details:', err);
      setError(t('failed_to_load_chapter'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [chapterId, setChapter, setLoading, setError, setHeaderTitle, navigation, chapterServiceRef.current, t]);

  const fetchNotesForStory = useCallback(async () => {
    if (!noteServiceRef.current || !selectedStory?.id) {
      setAllNotes([]);
      return;
    }
    try {
      const fetchedNotes = await noteServiceRef.current.getNotesByStoryId(selectedStory.id);
      setAllNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes for story:', err);
    }
  }, [selectedStory?.id, noteServiceRef.current]);

  const fetchNoteRelationsForChapter = useCallback(async () => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !chapterId) {
      setChapterNoteRelations([]);
      return;
    }
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, chapterId, 'Chapter');
      setChapterNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for chapter:', err);
    }
  }, [selectedStory?.id, chapterId, noteRelationServiceRef.current]);

  const fetchTagsForChapter = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id || !chapterId) {
      setChapterTags([]);
      return;
    }
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, chapterId, 'Chapter');
      setChapterTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch tags for chapter:', err);
    }
  }, [selectedStory?.id, chapterId, tagRelationServiceRef.current]);

  const fetchAllScenesInStory = useCallback(async () => {
    if (!sceneServiceRef.current || !selectedStory?.id) {
      setAllScenes([]);
      return;
    }
    try {
      const fetchedScenes = await sceneServiceRef.current.getScenesByStoryId(selectedStory.id);
      setAllScenes(fetchedScenes.filter(s => !s.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all scenes:', err);
    }
  }, [selectedStory?.id, sceneServiceRef.current]);

  const fetchAllLocationsInStory = useCallback(async () => {
    if (!locationServiceRef.current || !selectedStory?.id) {
      setAllLocations([]);
      return;
    }
    try {
      const fetchedLocations = await locationServiceRef.current.getAllByStoryId(selectedStory.id);
      setAllLocations(fetchedLocations.filter(l => !l.isDeleted));
    } catch (err) {
      console.error('Failed to fetch all locations:', err);
    }
  }, [selectedStory?.id, locationServiceRef.current]);

  const handleChapterChange = useCallback(async (changedStoryId: string, changedChapterId: string) => {
    if (changedChapterId === chapterId) {
      if (chapterServiceRef.current) {
        const updatedChapter = await chapterServiceRef.current.getById(chapterId);
        if (!updatedChapter || updatedChapter.isDeleted) {
          navigation.goBack();
        } else {
          setChapter(updatedChapter);
          setHeaderTitle(updatedChapter.name || t('chapter_details_title'));
        }
      }
    }
  }, [chapterId, navigation, setChapter, setHeaderTitle, chapterServiceRef.current, t]);

  const handleNoteChange = useCallback((changedStoryId: string, changedNoteId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchNotesForStory();
    }
  }, [selectedStory?.id, fetchNotesForStory]);

  const handleNoteRelationChange = useCallback((changedStoryId: string, changedNoteRelationId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchNoteRelationsForChapter();
    }
  }, [selectedStory?.id, fetchNoteRelationsForChapter]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === chapterId) {
      fetchTagsForChapter();
    }
  }, [chapterId, fetchTagsForChapter]);

  const handleSceneChange = useCallback((changedStoryId: string, changedSceneId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchAllScenesInStory();
    }
  }, [selectedStory?.id, fetchAllScenesInStory]);

  const handleLocationChange = useCallback((changedStoryId: string, changedLocationId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchAllLocationsInStory();
    }
  }, [selectedStory?.id, fetchAllLocationsInStory]);

  useEffect(() => {
    if (chapterServiceRef.current) {
      fetchChapter();
      entityEventEmitter.on('chapter_changed', handleChapterChange);
      entityEventEmitter.on('note_changed', handleNoteChange);
      entityEventEmitter.on('note_relation_changed', handleNoteRelationChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange); // Listen for tag relation changes
      entityEventEmitter.on('scene_changed', handleSceneChange); // Listen for scene changes
      entityEventEmitter.on('location_changed', handleLocationChange); // Listen for location changes

      return () => {
        entityEventEmitter.off('chapter_changed', handleChapterChange);
        entityEventEmitter.off('note_changed', handleNoteChange);
        entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange); // Cleanup listener
        entityEventEmitter.off('scene_changed', handleSceneChange); // Cleanup listener
        entityEventEmitter.off('location_changed', handleLocationChange); // Cleanup listener
      };
    }
  }, [chapterId, fetchChapter, handleChapterChange, handleNoteChange, handleNoteRelationChange, handleTagRelationChange, chapterServiceRef.current]);

  useEffect(() => {
    if (chapter) {
      fetchNotesForStory();
      fetchNoteRelationsForChapter();
      fetchTagsForChapter(); // Fetch tags when chapter is loaded
      fetchAllScenesInStory(); // Fetch all scenes
      fetchAllLocationsInStory(); // Fetch all locations
    }
  }, [chapter, fetchNotesForStory, fetchNoteRelationsForChapter, fetchTagsForChapter, fetchAllScenesInStory, fetchAllLocationsInStory]);

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await noteRelationServiceRef.current.saveNoteRelation(userId, relation);
      setChapterNoteRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, chapterId);
      Alert.alert(t('success'), t('note_relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_note_relation'));
      console.error('Failed to save note relation:', error);
    }
  };

  const handleDeleteNoteRelation = async (relationId: string) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await noteRelationServiceRef.current.deleteNoteRelation(userId, relationId);
      if (success) {
        setChapterNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, chapterId);
        Alert.alert(t('success'), t('note_relation_deleted_successfully'));
      } else {
        Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      console.error('Failed to delete note relation:', error);
    }
  };

  const renderHeaderRight = useCallback(() => (
    <TouchableOpacity
      onPress={() => navigation.navigate('ChapterForm', { chapterId: chapterId })}
      style={{ marginRight: 15 }}
    >
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, chapterId, colors.text]);

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
        <Text style={styles.detailText}>{t('loading_chapter_details')}</Text>
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

  if (!chapter) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{t('chapter_data_missing')}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>{chapter.name}</Text>
      <Text style={styles.detailText}>{t('summary')}: {chapter.summary || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('is_favorite')}: {chapter.isFavorite ? t('common_yes') : t('common_no')}</Text>
      <Text style={styles.detailText}>{t('extra_notes')}: {chapter.extraNotes || t('common_na')}</Text>

      <Text style={styles.sectionTitle}>{t('scenes_in_chapter_title')}</Text>
      <ChapterSceneManager
        currentChapterId={chapterId}
        availableScenes={allScenes}
        availableLocations={allLocations}
      />

      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
      <NoteManager
        noteRelations={chapterNoteRelations}
        availableNotes={allNotes}
        onSave={handleSaveNoteRelation}
        onDelete={handleDeleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={chapterId}
        currentEntityType="Chapter"
      />

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={chapterTags} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};


export default ChapterDetailScreen;