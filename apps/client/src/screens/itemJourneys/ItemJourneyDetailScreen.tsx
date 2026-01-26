import { Ionicons } from '@expo/vector-icons';
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NoteManager from '../../components/NoteManager';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { ItemJourneySelect, TagSelect } from '../../db/schema'; // Assuming TagSelect is still valid
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createItemJourneyService } from '../../services/ItemJourneyService';
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/NoteRelationService';
import { createNoteService, NoteService } from '../../services/NoteService';
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
import { useCharacterStore } from '../../state/characterStore';
import { useItemStore } from '../../state/itemStore';
import { useSceneStore } from '../../state/sceneStore';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { ItemJourneysScreenNavigationProp } from './ItemJourneyListScreen';

export type ItemJourneyDetailScreenParamList = {
  ItemJourneyDetail: { itemJourneyId: string };
};

type ItemJourneyDetailScreenRouteProp = RouteProp<ItemJourneyDetailScreenParamList, 'ItemJourneyDetail'>;

const ItemJourneyDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<ItemJourneysScreenNavigationProp>();
  const route = useRoute<ItemJourneyDetailScreenRouteProp>();
  const { itemJourneyId } = route.params;
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const itemJourneyServiceRef = useRef<ReturnType<typeof createItemJourneyService> | null>(null);
  const noteServiceRef = useRef<NoteService | null>(null);
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);

  const { items } = useItemStore();
  const { scenes } = useSceneStore();
  const { characters } = useCharacterStore();


  useEffect(() => {
    if (drizzleDb) {
      if (!itemJourneyServiceRef.current) itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
      if (!noteServiceRef.current) noteServiceRef.current = createNoteService(drizzleDb);
      if (!noteRelationServiceRef.current) noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      if (!tagServiceRef.current) tagServiceRef.current = createTagService(drizzleDb);
      if (!tagRelationServiceRef.current) tagRelationServiceRef.current = createTagRelationService(drizzleDb);
    }
  }, [drizzleDb]);

  const [itemJourney, setItemJourney] = useState<ItemJourneySelect | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [itemJourneyNoteRelations, setItemJourneyNoteRelations] = useState<NoteRelation[]>([]);
  const [itemJourneyTags, setItemJourneyTags] = useState<TagSelect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    subTitle: { fontSize: 20, fontWeight: '600', color: colors.textSecondary, marginBottom: 15 },
    detailText: { fontSize: 16, color: colors.text, marginBottom: 5 },
    errorText: { color: colors.error },
    buttonContainer: { marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 15, marginBottom: 5 },
    detailLabel: { fontSize: 16, fontWeight: 'bold', color: colors.textSecondary, marginTop: 5 },
  });

  const fetchItemJourney = useCallback(async () => {
    if (!itemJourneyServiceRef.current) {
      console.warn('Item Journey service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedItemJourney = await itemJourneyServiceRef.current.getById(itemJourneyId);
      if (fetchedItemJourney && !fetchedItemJourney.isDeleted) {
        setItemJourney(fetchedItemJourney);
        // Display item name + new state as title
        const relatedItem = items.find(item => item.id === fetchedItemJourney.itemId);
        setHeaderTitle(`${relatedItem?.name || t('unknown_item')} - ${fetchedItemJourney.newState}`);
      } else if (fetchedItemJourney && fetchedItemJourney.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('item_journey_not_found'));
        setHeaderTitle(t('item_journey_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch item journey details:', err);
      setError(t('failed_to_load_item_journey'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [itemJourneyId, navigation, t, items]);

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
    if (!noteRelationServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, itemJourneyId, 'ItemJourney');
      setItemJourneyNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for item journey:', err);
    }
  }, [selectedStory?.id, itemJourneyId]);

  const fetchTagsForItemJourney = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, itemJourneyId, 'ItemJourney');
      setItemJourneyTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch tags for item journey:', err);
    }
  }, [selectedStory?.id, itemJourneyId]);

  const handleItemJourneyChange = useCallback(async (changedStoryId: string, changedItemJourneyId: string) => {
    if (changedItemJourneyId === itemJourneyId && itemJourneyServiceRef.current) {
      const updatedItemJourney = await itemJourneyServiceRef.current.getById(itemJourneyId);
      if (!updatedItemJourney || updatedItemJourney.isDeleted) {
        navigation.goBack();
      } else {
        setItemJourney(updatedItemJourney);
        const relatedItem = items.find(item => item.id === updatedItemJourney.itemId);
        setHeaderTitle(`${relatedItem?.name || t('unknown_item')} - ${updatedItemJourney.newState}`);
      }
    }
  }, [itemJourneyId, navigation, t, items]);

  const handleNoteChange = useCallback(() => {
    fetchNotesForStory();
  }, [fetchNotesForStory]);

  const handleNoteRelationChange = useCallback(() => {
    fetchNoteRelationsForItemJourney();
  }, [fetchNoteRelationsForItemJourney]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === itemJourneyId) fetchTagsForItemJourney();
  }, [itemJourneyId, fetchTagsForItemJourney]);

  useEffect(() => {
    fetchItemJourney();
    entityEventEmitter.on('item_journey_changed', handleItemJourneyChange);
    entityEventEmitter.on('note_changed', handleNoteChange);
    entityEventEmitter.on('note_relation_changed', handleNoteRelationChange);
    entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);
    return () => {
      entityEventEmitter.off('item_journey_changed', handleItemJourneyChange);
      entityEventEmitter.off('note_changed', handleNoteChange);
      entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
      entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
    };
  }, [itemJourneyId, fetchItemJourney, handleItemJourneyChange, handleNoteChange, handleNoteRelationChange, handleTagRelationChange]);

  useEffect(() => {
    if (itemJourney) {
      fetchNotesForStory();
      fetchNoteRelationsForItemJourney();
      fetchTagsForItemJourney();
    }
  }, [itemJourney, fetchNotesForStory, fetchNoteRelationsForItemJourney, fetchTagsForItemJourney]);

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
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
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, itemJourneyId);
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
        setItemJourneyNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, itemJourneyId);
        Alert.alert(t('success'), t('note_relation_deleted_successfully'));
      } else {
        Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      }
    } catch (error) {
      Alert.alert(t('error'), t('failed_to_delete_note_relation'));
      console.error('Failed to delete note relation:', error);
    }
  };

  const relatedItem = items.find(item => item.id === itemJourney?.itemId);
  const relatedScene = scenes.find(scene => scene.id === itemJourney?.sceneId);
  const newCharacterOwner = characters.find(char => char.id === itemJourney?.newCharacterOwnerId);

  const renderHeaderRight = useCallback(() => (
    <TouchableOpacity onPress={() => navigation.navigate('ItemJourneyForm', { itemJourneyId })} style={{ marginRight: 15 }}>
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, itemJourneyId, colors.text]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return <View style={[styles.container, styles.centerContent]}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.detailText}>{t('loading_item_journey_details')}</Text></View>;
  }
  if (error) {
    return <View style={[styles.container, styles.centerContent]}><Text style={[styles.detailText, styles.errorText]}>{error}</Text><View style={styles.buttonContainer}><Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} /></View></View>;
  }
  if (!itemJourney) {
    return <View style={[styles.container, styles.centerContent]}><Text style={[styles.detailText, styles.errorText]}>{t('item_journey_data_missing')}</Text><View style={styles.buttonContainer}><Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} /></View></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>{relatedItem?.name || t('unknown_item')}</Text>
      <Text style={styles.subTitle}>{itemJourney.newState}</Text>
      
      {itemJourney.extraNotes && <Text style={styles.detailText}>{t('extra_notes')}: {itemJourney.extraNotes}</Text>}
      {relatedScene && <Text style={styles.detailText}>{t('scene')}: {relatedScene.name}</Text>}
      {newCharacterOwner && <Text style={styles.detailText}>{t('new_character_owner')}: {newCharacterOwner.name}</Text>}
      
      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
      <NoteManager
        noteRelations={itemJourneyNoteRelations}
        availableNotes={allNotes}
        onSave={handleSaveNoteRelation}
        onDelete={handleDeleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={itemJourneyId}
        currentEntityType="ItemJourney"
      />

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={itemJourneyTags} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ItemJourneyDetailScreen;