import MultiSelectPill from '@/src/components/common/MultiSelectPill/MultiSelectPill';
import Select from '@/src/components/common/Select/Select'; // Import Select component
import TextInput from '@/src/components/common/TextInput/TextInput';
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { Scene } from '@keres/shared/entities/Scene';
import { RouteProp, StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // Added useMemo
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import NoteManager from '../../components/NoteManager/NoteManager';
import { useDrizzle } from '../../db';
import { SceneSelect, TagSelect } from '../../db/schema'; // Import TagSelect
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { SceneStackParamList } from '../../navigation/MainSystemStack';
import { createLocationService } from '../../services/LocationService'; // Import LocationService
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/NoteRelationService';
import { createNoteService, NoteService } from '../../services/NoteService';
import { createSceneService } from '../../services/SceneService';
import { createTagRelationService } from '../../services/TagRelationService'; // Import TagRelationService
import { createTagService } from '../../services/TagService'; // Import TagService
import { useChapterStore } from '../../state/chapterStore'; // Import useChapterStore
import { useLocationStore } from '../../state/locationStore'; // Import useLocationStore
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';

type SceneFormScreenRouteProp = RouteProp<SceneStackParamList, 'SceneForm'>;
type SceneFormScreenNavigationProp = NativeStackNavigationProp<SceneStackParamList, 'SceneForm'>;

const SceneFormScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<SceneFormScreenNavigationProp>();
  const route = useRoute<SceneFormScreenRouteProp>();
  const { sceneId: initialSceneId } = route.params || {};
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();
  const { chapters, fetchChapters, setDbAndStoryId: setChapterDbAndStoryId, initializeService: initializeChapterService } = useChapterStore(); // For chapter selection
  const { locations, fetchLocations, setDbAndStoryId: setLocationDbAndStoryId, initializeService: initializeLocationService } = useLocationStore(); // For location selection

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const noteServiceRef = useRef<NoteService | null>(null);
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null); // Ref for TagService
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null); // Ref for TagRelationService
  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null); // Ref for LocationService

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
      if (!locationServiceRef.current) {
        locationServiceRef.current = createLocationService(drizzleDb); // Initialize LocationService
      }
    }
  }, [drizzleDb]);

  // Initialize Chapter Service and fetch chapters
  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setChapterDbAndStoryId(drizzleDb, selectedStory.id);
      initializeChapterService();
      fetchChapters();
    }
  }, [drizzleDb, selectedStory?.id, setChapterDbAndStoryId, initializeChapterService, fetchChapters]);

  // Initialize Location Service and fetch locations
  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setLocationDbAndStoryId(drizzleDb, selectedStory.id);
      initializeLocationService();
      fetchLocations();
    }
  }, [drizzleDb, selectedStory?.id, setLocationDbAndStoryId, initializeLocationService, fetchLocations]);

  const [currentSceneId, setCurrentSceneId] = useState<string | undefined>(initialSceneId);
  const [chapterId, setChapterId] = useState<string | null>(null); // State for selected chapter
  const [locationId, setLocationId] = useState<string | null>(null); // State for selected location
  const [name, setName] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [gap, setGap] = useState<number | null>(null);
  const [gapType, setGapType] = useState<string | null>(null); // e.g., 'minutes', 'hours', 'days'
  const [duration, setDuration] = useState<number | null>(null);
  const [durationType, setDurationType] = useState<string | null>(null); // e.g., 'minutes', 'hours', 'days'
  const [isStart, setIsStart] = useState(false);
  const [isFinish, setIsFinish] = useState(false);

  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [sceneNoteRelations, setSceneNoteRelations] = useState<NoteRelation[]>([]);
  const [availableTags, setAvailableTags] = useState<TagSelect[]>([]); // State for available tags
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]); // State for selected tag IDs

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!currentSceneId;

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_scene_title') : t('create_scene_title'),
        headerRight: () => {<View/>}
      });
    }, [navigation, isEditing, t])
  );

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
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentSceneId) {
      setSceneNoteRelations([]);
      return;
    }
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, currentSceneId, 'Scene');
      setSceneNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for scene:', err);
    }
  }, [selectedStory?.id, currentSceneId, noteRelationServiceRef.current]);

  const fetchAvailableTags = useCallback(async () => {
    if (!tagServiceRef.current || !selectedStory?.id) {
      setAvailableTags([]);
      return;
    }
    try {
      const fetchedTags = await tagServiceRef.current.getTagsByStoryId(selectedStory.id);
      setAvailableTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch available tags:', err);
    }
  }, [selectedStory?.id, tagServiceRef.current]);

  const fetchSceneTags = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id || !currentSceneId) {
      setSelectedTagIds([]);
      return;
    }
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, currentSceneId, 'Scene');
      setSelectedTagIds(fetchedTags.map(tag => tag.id));
    } catch (err) {
      console.error('Failed to fetch scene tags:', err);
    }
  }, [selectedStory?.id, currentSceneId, tagRelationServiceRef.current]);

  useEffect(() => {
    const loadSceneAndData = async () => {
      if (!sceneServiceRef.current || !selectedStory?.id) {
        console.warn('Scene service or selected story not available.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (isEditing) {
          const fetchedScene = await sceneServiceRef.current.getById(currentSceneId!);
          if (fetchedScene) {
            setChapterId(fetchedScene.chapterId);
            setLocationId(fetchedScene.locationId); // Set locationId
            setName(fetchedScene.name);
            setSummary(fetchedScene.summary);
            setIsFavorite(fetchedScene.isFavorite);
            setExtraNotes(fetchedScene.extraNotes);
            setGap(fetchedScene.gap);
            setGapType(fetchedScene.gapType);
            setDuration(fetchedScene.duration);
            setDurationType(fetchedScene.durationType);
            setIsStart(fetchedScene.isStart);
            setIsFinish(fetchedScene.isFinish);
          } else {
            setError(t('scene_not_found'));
          }
        }
      } catch (err) {
        console.error('Failed to load scene or related data:', err);
        setError(t('failed_to_load_scene'));
      } finally {
        setLoading(false);
        fetchNotesForStory();
        fetchNoteRelationsForScene();
        fetchAvailableTags(); // Fetch available tags
        fetchSceneTags();   // Fetch scene-specific tags
      }
    };
    loadSceneAndData();
  }, [currentSceneId, isEditing, selectedStory?.id, sceneServiceRef.current, t,
    fetchNotesForStory, fetchNoteRelationsForScene, fetchAvailableTags, fetchSceneTags
  ]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('error'), t('name_required'));
      return;
    }
    if (!chapterId) {
      Alert.alert(t('error'), t('chapter_required'));
      return;
    }
    if (!locationId) { // Validate locationId
        Alert.alert(t('error'), t('location_required'));
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
    setError(null);

    try {
      let sceneData: Omit<Scene, 'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt' | 'index'> = {
        chapterId: chapterId,
        locationId: locationId, // Include locationId
        name: name.trim(),
        summary,
        isFavorite,
        extraNotes,
        gap,
        gapType,
        duration,
        durationType,
        isStart,
        isFinish,
      };

      let savedScene: SceneSelect;

      if (isEditing) {
        savedScene = await sceneServiceRef.current!.updateScene(userId, currentSceneId!, sceneData);
        Alert.alert(t('success'), t('scene_updated_successfully'));
      } else {
        // For new scenes, determine the next index within the selected chapter
        const allScenesInChapter = (await sceneServiceRef.current!.getAllByStoryId(selectedStory.id))
          .filter(scn => scn.chapterId === chapterId);
        const nextIndex = allScenesInChapter.length > 0 ? Math.max(...allScenesInChapter.map(scn => scn.index || 0)) + 1 : 1;
        savedScene = await sceneServiceRef.current!.createScene(userId, { ...sceneData, storyId: selectedStory.id, index: nextIndex });
        Alert.alert(t('success'), t('scene_created_successfully'));
        setCurrentSceneId(savedScene.id);
      }
      
      // Update tag relations
      if (savedScene.id && tagRelationServiceRef.current && selectedStory?.id) {
        await tagRelationServiceRef.current.updateTagsForEntity(userId, selectedStory.id, savedScene.id, 'Scene', selectedTagIds);
      }
      
      entityEventEmitter.emit('scene_changed', selectedStory.id, savedScene.id);

      if (!isEditing && savedScene.id) {
        navigation.dispatch(StackActions.replace('SceneForm', { sceneId: savedScene.id }));
      } else {
        navigation.goBack();
      }

    } catch (err) {
      console.error('Failed to save scene:', err);
      setError(t('failed_to_save_scene'));
      Alert.alert(t('error'), t('failed_to_save_scene'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }

    Alert.alert(
      t('delete_scene_title'),
      t('delete_scene_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          onPress: async () => {
            if (currentSceneId && sceneServiceRef.current) {
              try {
                setLoading(true);
                await sceneServiceRef.current.deleteScene(userId, currentSceneId);
                entityEventEmitter.emit('scene_changed', selectedStory?.id, currentSceneId);
                Alert.alert(t('success'), t('scene_deleted_successfully'));
                navigation.goBack();
              } catch (err) {
                console.error('Failed to delete scene:', err);
                setError(t('failed_to_delete_scene'));
                Alert.alert(t('error'), t('failed_to_delete_scene'));
              } finally {
                setLoading(false);
              }
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const handleTagSelectionChange = useCallback((newSelection: string[]) => {
    setSelectedTagIds(newSelection);
  }, []);

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentSceneId || !userId) {
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
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, currentSceneId);
      Alert.alert(t('success'), t('note_relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_note_relation'));
      console.error('Failed to save note relation:', error);
    }
  };

  const handleDeleteNoteRelation = async (relationId: string) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentSceneId || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await noteRelationServiceRef.current.deleteNoteRelation(userId, relationId);
      if (success) {
        setSceneNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, currentSceneId);
        Alert.alert(t('success'), t('note_relation_deleted_successfully'));
      } else {
        Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      console.error('Failed to delete note relation:', error);
    }
  };

  const chapterOptions = useMemo(() => {
    return chapters.map(chapter => ({ label: chapter.name, value: chapter.id }));
  }, [chapters]);

  const locationOptions = useMemo(() => {
    return locations.map(location => ({ label: location.name, value: location.id }));
  }, [locations]);

  const gapDurationTypeOptions = [
    { label: t('minutes'), value: 'minutes' },
    { label: t('hours'), value: 'hours' },
    { label: t('days'), value: 'days' },
    { label: t('weeks'), value: 'weeks' },
    { label: t('months'), value: 'months' },
    { label: t('years'), value: 'years' },
  ];

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
    noteSection: { // Renamed from tagSection for clarity, though it might contain tags in other forms
      marginTop: 20,
      marginBottom: 10,
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
    halfWidthInput: {
        width: '48%',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_scene_title') : t('create_scene_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('scene_form_description')}
          </Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('chapter')}</Text>
          <Select
            options={chapterOptions}
            value={chapterId}
            onValueChange={setChapterId}
            placeholder={t('select_chapter')}
            multiple={false}
            disabled={isEditing} // Cannot change chapter for existing scenes to avoid complex re-indexing
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('location')}</Text>
          <Select
            options={locationOptions}
            value={locationId}
            onValueChange={setLocationId}
            placeholder={t('select_location')}
            multiple={false}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('name')}</Text>
          <TextInput
            placeholder={t('name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('summary')}</Text>
          <TextInput
            placeholder={t('summary_placeholder')}
            value={summary || ""}
            onChangeText={setSummary}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5}]}>{t('is_favorite')}</Text>
            <Switch
              value={isFavorite}
              onValueChange={setIsFavorite}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isFavorite ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ""}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          {/* New Scene Fields */}
          <Text style={[styles.label, { color: colors.text }]}>{t('gap')}</Text>
          <View style={styles.row}>
            <TextInput
              placeholder={t('gap_placeholder')}
              value={gap !== null ? String(gap) : ''}
              onChangeText={(text) => setGap(text ? Number(text) : null)}
              keyboardType="numeric"
              style={[commonInputStyles.input, styles.halfWidthInput]}
            />
            <Select
              options={gapDurationTypeOptions}
              value={gapType}
              onValueChange={setGapType}
              placeholder={t('gap_type_placeholder')}
              multiple={false}
            />
          </View>

          <Text style={[styles.label, { color: colors.text }]}>{t('duration')}</Text>
          <View style={styles.row}>
            <TextInput
              placeholder={t('duration_placeholder')}
              value={duration !== null ? String(duration) : ''}
              onChangeText={(text) => setDuration(text ? Number(text) : null)}
              keyboardType="numeric"
              style={[commonInputStyles.input, styles.halfWidthInput]}
            />
            <Select
              options={gapDurationTypeOptions}
              value={durationType}
              onValueChange={setDurationType}
              placeholder={t('duration_type_placeholder')}
              multiple={false}
            />
          </View>

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5}]}>{t('is_start_scene')}</Text>
            <Switch
              value={isStart}
              onValueChange={setIsStart}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isStart ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>

          <View style={styles.switchContainer}>
            <Text style={[styles.label, { color: colors.text, flex: 1, lineHeight: 30, marginTop: 5}]}>{t('is_finish_scene')}</Text>
            <Switch
              value={isFinish}
              onValueChange={setIsFinish}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isFinish ? colors.onPrimary : colors.textSecondary}
              style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
            />
          </View>
          {/* End New Scene Fields */}

          {currentSceneId && selectedStory?.id && (
            <View style={styles.tagSection}>
              <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
              <MultiSelectPill
                options={availableTags.map(tag => ({ label: tag.name, value: tag.id, color: tag.color || colors.primaryContainer }))}
                selectedValues={selectedTagIds}
                onSelectionChange={handleTagSelectionChange}
                placeholder={t('select_tags_for_scene')}
                label={t('scene_tags')}
              />
            </View>
          )}

          {currentSceneId && selectedStory?.id && (
            <View style={styles.noteSection}>
              <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
              <NoteManager
                noteRelations={sceneNoteRelations}
                availableNotes={allNotes}
                onSave={handleSaveNoteRelation}
                onDelete={handleDeleteNoteRelation}
                editable={true}
                currentStoryId={selectedStory.id}
                currentEntityId={currentSceneId}
                currentEntityType="Scene"
              />
            </View>
          )}

          <Button onPress={handleSave} style={styles.saveButton}>
            {t('save_scene')}
          </Button>

          {isEditing && (
            <Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>
              {t('delete_scene_title')}
            </Button>
          )}

          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>    
    </KeyboardAvoidingView>
  );
};

export default SceneFormScreen;
