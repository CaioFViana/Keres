import { Ionicons } from '@expo/vector-icons';
import { Chapter } from '@keres/shared/entities/Chapter';
import { CharacterScene } from '@keres/shared/entities/CharacterScene'; // Import CharacterScene entity
import { Choice } from '@keres/shared/entities/Choice'; // Import Choice
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CharacterManager from '../../components/CharacterManager/CharacterManager'; // Import CharacterManager
import TagChipList from '../../components/common/TagChipList/TagChipList'; // Import TagChipList
import NoteManager from '../../components/NoteManager/NoteManager';
import SceneNavigationControls from '../../components/SceneNavigationControls/SceneNavigationControls'; // Import SceneNavigationControls
import { useDrizzle } from '../../db';
import { SceneSelect, TagSelect } from '../../db/schema'; // Import TagSelect
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { ChapterService, createChapterService } from '../../services/ChapterService'; // Import ChapterService
import { CharacterSceneServiceInterface, createCharacterSceneService } from '../../services/CharacterSceneService'; // Import CharacterSceneService
import { ChoiceService, createChoiceService } from '../../services/ChoiceService'; // Import ChoiceService
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/NoteRelationService';
import { createNoteService, NoteService } from '../../services/NoteService';
import { createSceneService } from '../../services/SceneService';
import { createTagRelationService } from '../../services/TagRelationService'; // Import TagRelationService
import { createTagService } from '../../services/TagService'; // Import TagService
import { useCharacterStore } from '../../state/characterStore'; // Import useCharacterStore
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { ScenesScreenNavigationProp } from './SceneListScreen';

// Define the parameter list for this screen
export type SceneDetailScreenParamList = {
  SceneDetail: { sceneId: string };
};

type SceneDetailScreenRouteProp = RouteProp<SceneDetailScreenParamList, 'SceneDetail'>;

const SceneDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<ScenesScreenNavigationProp>();
  const route = useRoute<SceneDetailScreenRouteProp>();
  const { sceneId } = route.params;
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const noteServiceRef = useRef<NoteService | null>(null);
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null); // Ref for TagService
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null); // Ref for TagRelationService
  const chapterServiceRef = useRef<ChapterService | null>(null); // Ref for ChapterService
  const choiceServiceRef = useRef<ChoiceService | null>(null); // Ref for ChoiceService
  const characterSceneServiceRef = useRef<CharacterSceneServiceInterface | null>(null); // Ref for CharacterSceneService

  const { characters, fetchCharacters, setDbAndStoryId: setCharacterDbAndStoryId, initializeService: initializeCharacterService } = useCharacterStore(); // For character data

  // Initialize services once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!sceneServiceRef.current) {
        sceneServiceRef.current = createSceneService(drizzleDb);
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
      if (!chapterServiceRef.current) {
        chapterServiceRef.current = createChapterService(drizzleDb);
      }
      if (!choiceServiceRef.current) {
        choiceServiceRef.current = createChoiceService(drizzleDb);
      }
      if (!characterSceneServiceRef.current) {
        characterSceneServiceRef.current = createCharacterSceneService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  // Initialize Character Service and fetch characters
  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setCharacterDbAndStoryId(drizzleDb, selectedStory.id);
      initializeCharacterService();
      fetchCharacters();
    }
  }, [drizzleDb, selectedStory?.id, setCharacterDbAndStoryId, initializeCharacterService, fetchCharacters]);

  const [scene, setScene] = useState<SceneSelect | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null); // State for chapter details
  const [previousScene, setPreviousScene] = useState<SceneSelect | undefined>(undefined); // State for previous scene
  const [nextScene, setNextScene] = useState<SceneSelect | undefined>(undefined); // State for next scene
  const [choicesForScene, setChoicesForScene] = useState<Choice[]>([]); // State for choices
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [sceneNoteRelations, setSceneNoteRelations] = useState<NoteRelation[]>([]);
  const [sceneTags, setSceneTags] = useState<TagSelect[]>([]); // State for scene-specific tags
  const [characterSceneRelations, setCharacterSceneRelations] = useState<CharacterScene[]>([]); // State for character-scene relations
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

  const fetchScene = useCallback(async () => {
    if (!sceneServiceRef.current) {
      console.warn('Scene service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedScene = await sceneServiceRef.current.getById(sceneId);
      if (fetchedScene && !fetchedScene.isDeleted) {
        setScene(fetchedScene);
        setHeaderTitle(fetchedScene.name || t('scene_details_title'));
      } else if (fetchedScene && fetchedScene.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('scene_not_found'));
        setHeaderTitle(t('scene_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch scene details:', err);
      setError(t('failed_to_load_scene'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [sceneId, setScene, setLoading, setError, setHeaderTitle, navigation, sceneServiceRef.current, t]);

  const fetchChapter = useCallback(async () => {
    if (!chapterServiceRef.current || !scene?.chapterId) {
      setChapter(null);
      return;
    }
    try {
      const fetchedChapter = await chapterServiceRef.current.getById(scene.chapterId);
      setChapter(fetchedChapter || null);
    } catch (err) {
      console.error('Failed to fetch chapter details:', err);
      setChapter(null);
    }
  }, [chapterServiceRef.current, scene?.chapterId]);

  const fetchPreviousNextScenes = useCallback(async () => {
    if (!sceneServiceRef.current || !selectedStory?.id || !sceneId || !chapter?.id || selectedStory.type !== 'linear') {
      setPreviousScene(undefined);
      setNextScene(undefined);
      return;
    }
    try {
      const { previousScene, nextScene } = await sceneServiceRef.current.getPreviousNextScenes(selectedStory.id, sceneId, chapter.id);
      setPreviousScene(previousScene);
      setNextScene(nextScene);
    } catch (err) {
      console.error('Failed to fetch previous/next scenes:', err);
      setPreviousScene(undefined);
      setNextScene(undefined);
    }
  }, [sceneServiceRef.current, selectedStory?.id, sceneId, chapter?.id, selectedStory?.type]);

  const fetchChoicesForScene = useCallback(async () => {
    if (!choiceServiceRef.current || !selectedStory?.id || !sceneId || selectedStory.type !== 'branching') {
      setChoicesForScene([]);
      return;
    }
    try {
      const choices = await choiceServiceRef.current.getChoicesByStoryId(selectedStory.id, undefined, undefined, undefined, undefined, { fromSceneId: sceneId });
      setChoicesForScene(choices);
    } catch (err) {
      console.error('Failed to fetch choices for scene:', err);
      setChoicesForScene([]);
    }
  }, [choiceServiceRef.current, selectedStory?.id, sceneId, selectedStory?.type]);

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

  const fetchNoteRelationsForScene = useCallback(async () => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !sceneId) {
      setSceneNoteRelations([]);
      return;
    }
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, sceneId, 'Scene');
      setSceneNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for scene:', err);
    }
  }, [selectedStory?.id, sceneId, noteRelationServiceRef.current]);

  const fetchTagsForScene = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id || !sceneId) {
      setSceneTags([]);
      return;
    }
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, sceneId, 'Scene');
      setSceneTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch tags for scene:', err);
    }
  }, [selectedStory?.id, sceneId, tagRelationServiceRef.current]);

  const fetchCharacterSceneRelations = useCallback(async () => {
    if (!characterSceneServiceRef.current || !selectedStory?.id || !sceneId) {
      setCharacterSceneRelations([]);
      return;
    }
    try {
      const fetchedRelations = await characterSceneServiceRef.current.getRelationsForScene(selectedStory.id, sceneId);
      setCharacterSceneRelations(fetchedRelations);
    } catch (err) {
      console.error('Failed to fetch character-scene relations:', err);
    }
  }, [selectedStory?.id, sceneId, characterSceneServiceRef.current]);

  const handleSceneChange = useCallback(async (changedStoryId: string, changedSceneId: string) => {
    if (changedSceneId === sceneId) {
      if (sceneServiceRef.current) {
        const updatedScene = await sceneServiceRef.current.getById(sceneId);
        if (!updatedScene || updatedScene.isDeleted) {
          navigation.goBack();
        } else {
          setScene(updatedScene);
          setHeaderTitle(updatedScene.name || t('scene_details_title'));
        }
      }
      fetchChapter();
      if (selectedStory?.type === 'linear') {
        fetchPreviousNextScenes();
      } else if (selectedStory?.type === 'branching') {
        fetchChoicesForScene();
      }
    }
  }, [sceneId, navigation, setScene, setHeaderTitle, sceneServiceRef.current, t, fetchChapter, selectedStory?.type, fetchPreviousNextScenes, fetchChoicesForScene]);

  const handleNoteChange = useCallback((changedStoryId: string, changedNoteId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchNotesForStory();
    }
  }, [selectedStory?.id, fetchNotesForStory]);

  const handleNoteRelationChange = useCallback((changedStoryId: string, changedNoteRelationId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchNoteRelationsForScene();
    }
  }, [selectedStory?.id, fetchNoteRelationsForScene]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === sceneId) {
      fetchTagsForScene();
    }
  }, [sceneId, fetchTagsForScene]);

  const handleCharacterSceneChange = useCallback((changedStoryId: string, changedSceneId: string) => {
    if (changedSceneId === sceneId) {
      fetchCharacterSceneRelations();
    }
  }, [sceneId, fetchCharacterSceneRelations]);

  useEffect(() => {
    if (sceneServiceRef.current) {
      fetchScene();
      entityEventEmitter.on('scene_changed', handleSceneChange);
      entityEventEmitter.on('note_changed', handleNoteChange);
      entityEventEmitter.on('note_relation_changed', handleNoteRelationChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange); // Listen for tag relation changes
      entityEventEmitter.on('character_scene_changed', handleCharacterSceneChange); // Listen for character scene changes

      return () => {
        entityEventEmitter.off('scene_changed', handleSceneChange);
        entityEventEmitter.off('note_changed', handleNoteChange);
        entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange); // Cleanup listener
        entityEventEmitter.off('character_scene_changed', handleCharacterSceneChange); // Cleanup listener
      };
    }
  }, [sceneId, fetchScene, handleSceneChange, handleNoteChange, handleNoteRelationChange, handleTagRelationChange, handleCharacterSceneChange, sceneServiceRef.current, fetchChapter]);

  useEffect(() => {
    if (scene) {
      fetchChapter();
      fetchNotesForStory();
      fetchNoteRelationsForScene();
      fetchTagsForScene();
      fetchCharacterSceneRelations();
    }
  }, [scene, fetchChapter, fetchNotesForStory, fetchNoteRelationsForScene, fetchTagsForScene, fetchCharacterSceneRelations]);

  useEffect(() => {
    if (selectedStory?.type === 'linear' && scene && chapter) {
      fetchPreviousNextScenes();
    } else if (selectedStory?.type === 'branching' && scene) {
      fetchChoicesForScene();
    }
  }, [selectedStory, selectedStory?.type, scene, chapter, fetchPreviousNextScenes, fetchChoicesForScene]);

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await noteRelationServiceRef.current.saveNoteRelation(userId, relation);
      setSceneNoteRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, sceneId);
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
        setSceneNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, sceneId);
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
      onPress={() => navigation.navigate('SceneForm', { sceneId: sceneId })}
      style={{ marginRight: 15 }}
    >
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, sceneId, colors.text]);

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
        <Text style={styles.detailText}>{t('loading_scene_details')}</Text>
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

  if (!scene) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{t('scene_data_missing')}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {chapter && (
        <Text style={styles.subTitle}>
          {selectedStory?.type === 'linear' ? `${chapter.index}. ` : ''}
          {chapter.name}
        </Text>
      )}
      <Text style={styles.mainTitle}>
        {selectedStory?.type === 'linear' ? `${scene.index}. ` : ''}
        {scene.name}
      </Text>
      <Text style={styles.detailText}>{t('summary')}: {scene.summary || t('common_na')}</Text>
      <Text style={styles.detailText}>{t('is_favorite')}: {scene.isFavorite ? t('common_yes') : t('common_no')}</Text>
      <Text style={styles.detailText}>{t('extra_notes')}: {scene.extraNotes || t('common_na')}</Text>

      <Text style={styles.sectionTitle}>{t('characters_title')}</Text>
      <CharacterManager
        characterRelations={characterSceneRelations}
        availableCharacters={characters.filter(char => !char.isDeleted)}
        onSave={() => Promise.resolve()}
        onDelete={() => Promise.resolve()}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={sceneId}
        currentEntityType="Scene"
      />

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={sceneTags} />

      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
      <NoteManager
        noteRelations={sceneNoteRelations}
        availableNotes={allNotes}
        onSave={handleSaveNoteRelation}
        onDelete={handleDeleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={sceneId}
        currentEntityType="Scene"
      />

      <SceneNavigationControls
        storyType={selectedStory?.type}
        previousScene={previousScene}
        nextScene={nextScene}
        choicesForScene={choicesForScene}
      />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};


export default SceneDetailScreen;