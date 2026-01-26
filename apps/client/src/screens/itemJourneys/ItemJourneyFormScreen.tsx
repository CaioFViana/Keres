import MultiSelectPill from '@/src/components/common/MultiSelectPill/MultiSelectPill';
import Select from '@/src/components/common/Select/Select';
import SuggestionTextInput from '@/src/components/common/SuggestionTextInput/SuggestionTextInput';
import TextInput from '@/src/components/common/TextInput/TextInput';
import { ItemJourney } from '@keres/shared/entities/Item';
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { RouteProp, StackActions, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import NoteManager from '../../components/NoteManager/NoteManager';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { ItemJourneyStackParamList } from '../../navigation/MainSystemStack';
import { createItemJourneyService } from '../../services/ItemJourneyService';
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/NoteRelationService';
import { createNoteService, NoteService } from '../../services/NoteService';
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
import { useCharacterStore } from '../../state/characterStore'; // Assuming CharacterStore for characters
import { useItemStore } from '../../state/itemStore'; // Assuming ItemStore for items
import { useSceneStore } from '../../state/sceneStore'; // Assuming SceneStore for scenes
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';

type ItemJourneyFormScreenRouteProp = RouteProp<ItemJourneyStackParamList, 'ItemJourneyForm'>;
type ItemJourneyFormScreenNavigationProp = NativeStackNavigationProp<ItemJourneyStackParamList, 'ItemJourneyForm'>;

const ItemJourneyFormScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<ItemJourneyFormScreenNavigationProp>();
  const route = useRoute<ItemJourneyFormScreenRouteProp>();
  const { itemJourneyId: initialItemJourneyId } = route.params || {};
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const { items, fetchItems, setDbAndStoryId: setItemDbAndStoryId, initializeService: initializeItemService } = useItemStore();
  const { scenes, fetchScenes, setDbAndStoryId: setSceneDbAndStoryId, initializeService: initializeSceneService } = useSceneStore();
  const { characters, fetchCharacters, setDbAndStoryId: setCharacterDbAndStoryId, initializeService: initializeCharacterService } = useCharacterStore();

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();

  const itemJourneyServiceRef = useRef<ReturnType<typeof createItemJourneyService> | null>(null);
  const noteServiceRef = useRef<NoteService | null>(null);
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);

  useEffect(() => {
    if (drizzleDb) {
      if (!itemJourneyServiceRef.current) itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
      if (!noteServiceRef.current) noteServiceRef.current = createNoteService(drizzleDb);
      if (!noteRelationServiceRef.current) noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      if (!tagServiceRef.current) tagServiceRef.current = createTagService(drizzleDb);
      if (!tagRelationServiceRef.current) tagRelationServiceRef.current = createTagRelationService(drizzleDb);
    }
  }, [drizzleDb]);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      setItemDbAndStoryId(drizzleDb, selectedStory.id);
      initializeItemService();
      fetchItems();

      setSceneDbAndStoryId(drizzleDb, selectedStory.id);
      initializeSceneService();
      fetchScenes();

      setCharacterDbAndStoryId(drizzleDb, selectedStory.id);
      initializeCharacterService();
      fetchCharacters();
    }
  }, [drizzleDb, selectedStory?.id,
    setItemDbAndStoryId, initializeItemService, fetchItems,
    setSceneDbAndStoryId, initializeSceneService, fetchScenes,
    setCharacterDbAndStoryId, initializeCharacterService, fetchCharacters
  ]);


  const [currentItemJourneyId, setCurrentItemJourneyId] = useState<string | undefined>(initialItemJourneyId);
  const [itemId, setItemId] = useState<string | null>(null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [newCharacterOwnerId, setNewCharacterOwnerId] = useState<string | null>(null);
  const [newState, setNewState] = useState<string>('');
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [itemJourneyNoteRelations, setItemJourneyNoteRelations] = useState<NoteRelation[]>([]);
  const [availableTags, setAvailableTags] = useState<TagSelect[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!currentItemJourneyId;

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: isEditing ? t('edit_item_journey_title') : t('create_item_journey_title'),
        headerRight: () => <View />,
      });
    }, [navigation, isEditing, t])
  );

  const fetchNotesForStory = useCallback(async () => {
    if (!noteServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedNotes = await noteServiceRef.current.getNotesByStoryId(selectedStory.id);
      setAllNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes for story:', err);
    }
  }, [selectedStory?.id]);

  const fetchNoteRelationsForItemJourney = useCallback(async () => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentItemJourneyId) return;
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, currentItemJourneyId, 'ItemJourney');
      setItemJourneyNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for item journey:', err);
    }
  }, [selectedStory?.id, currentItemJourneyId]);

  const fetchAvailableTags = useCallback(async () => {
    if (!tagServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedTags = await tagServiceRef.current.getTagsByStoryId(selectedStory.id);
      setAvailableTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch available tags:', err);
    }
  }, [selectedStory?.id]);

  const fetchItemJourneyTags = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id || !currentItemJourneyId) return;
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, currentItemJourneyId, 'ItemJourney');
      setSelectedTagIds(fetchedTags.map(tag => tag.id));
    } catch (err) {
      console.error('Failed to fetch item journey tags:', err);
    }
  }, [selectedStory?.id, currentItemJourneyId]);

  useEffect(() => {
    const loadItemJourneyAndData = async () => {
      if (!itemJourneyServiceRef.current || !selectedStory?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        if (isEditing) {
          const fetchedItemJourney = await itemJourneyServiceRef.current.getById(currentItemJourneyId!);
          if (fetchedItemJourney) {
            setItemId(fetchedItemJourney.itemId);
            setSceneId(fetchedItemJourney.sceneId);
            setNewCharacterOwnerId(fetchedItemJourney.newCharacterOwnerId);
            setNewState(fetchedItemJourney.newState);
            setExtraNotes(fetchedItemJourney.extraNotes);
          } else {
            setError(t('item_journey_not_found'));
          }
        }
      } catch (err) {
        console.error('Failed to load item journey or related data:', err);
        setError(t('failed_to_load_item_journey'));
      } finally {
        setLoading(false);
        fetchNotesForStory();
        fetchNoteRelationsForItemJourney();
        fetchAvailableTags();
        fetchItemJourneyTags();
      }
    };
    loadItemJourneyAndData();
  }, [currentItemJourneyId, isEditing, selectedStory?.id, t, fetchNotesForStory, fetchNoteRelationsForItemJourney, fetchAvailableTags, fetchItemJourneyTags]);

  const handleSave = async () => {
    if (!itemId) {
      Alert.alert(t('error'), t('item_required'));
      return;
    }
    if (!sceneId) {
      Alert.alert(t('error'), t('scene_required'));
      return;
    }
    if (!newState.trim()) {
      Alert.alert(t('error'), t('new_state_required'));
      return;
    }
    if (!userId || !selectedStory?.id) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemJourneyData: Omit<ItemJourney, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'> = {
        storyId: selectedStory.id,
        itemId: itemId!,
        sceneId: sceneId!,
        newCharacterOwnerId: newCharacterOwnerId,
        newState: newState.trim(),
        extraNotes: extraNotes
      };

      let savedItemJourneyId: string | undefined = currentItemJourneyId;

      if (isEditing && currentItemJourneyId) {
        const savedItemJourney = await itemJourneyServiceRef.current!.updateItemJourney(userId, currentItemJourneyId, itemJourneyData);
        savedItemJourneyId = savedItemJourney.id;
        Alert.alert(t('success'), t('item_journey_updated_successfully'));
      } else {
        const savedItemJourney = await itemJourneyServiceRef.current!.createItemJourney(userId, itemJourneyData);
        savedItemJourneyId = savedItemJourney.id;
        Alert.alert(t('success'), t('item_journey_created_successfully'));
      }

      if (savedItemJourneyId && tagRelationServiceRef.current) {
        await tagRelationServiceRef.current.updateTagsForEntity(userId, selectedStory.id, savedItemJourneyId, 'ItemJourney', selectedTagIds);
      }
      entityEventEmitter.emit('item_journey_changed', selectedStory.id, savedItemJourneyId);

      if (!isEditing && savedItemJourneyId) {
        navigation.dispatch(StackActions.replace('ItemJourneyForm', { itemJourneyId: savedItemJourneyId }));
      } else {
        navigation.goBack();
      }
    } catch (err) {
      console.error('Failed to save item journey:', err);
      setError(t('failed_to_save_item_journey'));
      Alert.alert(t('error'), t('failed_to_save_item_journey'));
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
      t('delete_item_journey_title'),
      t('delete_item_journey_message'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          onPress: async () => {
            if (currentItemJourneyId && itemJourneyServiceRef.current) {
              try {
                setLoading(true);
                await itemJourneyServiceRef.current.deleteItemJourney(userId, currentItemJourneyId);
                entityEventEmitter.emit('item_journey_changed', selectedStory?.id, currentItemJourneyId);
                Alert.alert(t('success'), t('item_journey_deleted_successfully'));
                navigation.goBack();
              } catch (err) {
                console.error('Failed to delete item journey:', err);
                setError(t('failed_to_delete_item_journey'));
                Alert.alert(t('error'), t('failed_to_delete_item_journey'));
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

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentItemJourneyId || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await noteRelationServiceRef.current.saveNoteRelation(userId, relation);
      setItemJourneyNoteRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        }
        return [...prev, savedRelation];
      });
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, currentItemJourneyId);
      Alert.alert(t('success'), t('note_relation_saved_successfully'));
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_save_note_relation'));
      console.error('Failed to save note relation:', error);
    }
  };

  const handleDeleteNoteRelation = async (relationId: string) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !currentItemJourneyId || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const success = await noteRelationServiceRef.current.deleteNoteRelation(userId, relationId);
      if (success) {
        setItemJourneyNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, currentItemJourneyId);
        Alert.alert(t('success'), t('note_relation_deleted_successfully'));
      } else {
        Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      console.error('Failed to delete note relation:', error);
    }
  };

  const itemOptions = useMemo(() =>
    items
      .filter(item => !item.isDeleted)
      .map(item => ({ label: item.name, value: item.id })),
    [items]
  );

  const sceneOptions = useMemo(() =>
    scenes
      .filter(scene => !scene.isDeleted)
      .map(scene => ({ label: scene.name, value: scene.id })),
    [scenes]
  );

  const characterOptions = useMemo(() =>
    characters
      .filter(char => !char.isDeleted)
      .map(char => ({ label: char.name, value: char.id })),
    [characters]
  );

  const styles = StyleSheet.create({
    scrollViewContent: { padding: 20, paddingBottom: 350, flexGrow: 1 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    label: { fontSize: 16, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
    switchContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15, marginBottom: 5 },
    saveButton: { marginTop: 20, marginBottom: 0 },
    deleteButton: { backgroundColor: 'red', marginBottom: 15 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noteSection: { marginTop: 20, marginBottom: 10 },
    tagSection: { marginTop: 20, marginBottom: 10 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 10 },
  });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{isEditing ? t('edit_item_journey_title') : t('create_item_journey_title')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>{t('item_journey_form_description')}</Text>

          <Text style={[styles.label, { color: colors.text }]}>{t('item')}</Text>
          <Select
            options={itemOptions}
            value={itemId}
            onValueChange={setItemId}
            placeholder={t('select_item')}
            multiple={false}
            allowDeselect={true}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('scene')}</Text>
          <Select
            options={sceneOptions}
            value={sceneId}
            onValueChange={setSceneId}
            placeholder={t('select_scene')}
            multiple={false}
            allowDeselect={true}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('new_character_owner')}</Text>
          <Select
            options={characterOptions}
            value={newCharacterOwnerId}
            onValueChange={setNewCharacterOwnerId}
            placeholder={t('select_new_character_owner')}
            multiple={false}
            allowDeselect={true}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('new_state')}</Text>
          <SuggestionTextInput
            placeholder={t('new_state_placeholder')}
            value={newState || ''}
            onChangeText={setNewState}
            type="item_state"
            style={commonInputStyles.input}
            storyId={selectedStory?.id || ''}
          />

          <Text style={[styles.label, { color: colors.text }]}>{t('extra_notes')}</Text>
          <TextInput
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ''}
            onChangeText={setExtraNotes}
            style={[commonInputStyles.input, { minHeight: 5 * 20, textAlignVertical: 'top' }]}
            multiline
          />

          {currentItemJourneyId && selectedStory?.id && (
            <View style={styles.tagSection}>
              <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
              <MultiSelectPill
                options={availableTags.map(tag => ({ label: tag.name, value: tag.id, color: tag.color || colors.primaryContainer }))}
                selectedValues={selectedTagIds}
                onSelectionChange={setSelectedTagIds}
                placeholder={t('select_tags_for_item_journey')}
                label={t('item_journey_tags')}
              />
            </View>
          )}

          {currentItemJourneyId && selectedStory?.id && (
            <View style={styles.noteSection}>
              <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
              <NoteManager
                noteRelations={itemJourneyNoteRelations}
                availableNotes={allNotes}
                onSave={handleSaveNoteRelation}
                onDelete={handleDeleteNoteRelation}
                editable={true}
                currentStoryId={selectedStory.id}
                currentEntityId={currentItemJourneyId}
                currentEntityType="ItemJourney"
              />
            </View>
          )}

          <Button onPress={handleSave} style={styles.saveButton}>{t('save_item_journey')}</Button>
          {isEditing && (<Button onPress={handleDelete} style={[styles.saveButton, styles.deleteButton]}>{t('delete_item_journey_title')}</Button>)}
          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default ItemJourneyFormScreen;