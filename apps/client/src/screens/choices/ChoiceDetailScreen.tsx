import { Ionicons } from '@expo/vector-icons';
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NoteManager from '../../components/NoteManager/NoteManager';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { ChoiceSelect, TagSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { ChoicesScreenNavigationProp } from './ChoiceListScreen';
import { createChoiceService } from '../../services/ChoiceService';
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/NoteRelationService';
import { createNoteService, NoteService } from '../../services/NoteService';
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';

export type ChoiceDetailScreenParamList = {
  ChoiceDetail: { choiceId: string };
};

type ChoiceDetailScreenRouteProp = RouteProp<ChoiceDetailScreenParamList, 'ChoiceDetail'>;

const ChoiceDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();
  const route = useRoute<ChoiceDetailScreenRouteProp>();
  const { choiceId } = route.params;
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);
  const noteServiceRef = useRef<NoteService | null>(null);
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);

  useEffect(() => {
    if (drizzleDb) {
      if (!choiceServiceRef.current) choiceServiceRef.current = createChoiceService(drizzleDb);
      if (!noteServiceRef.current) noteServiceRef.current = createNoteService(drizzleDb);
      if (!noteRelationServiceRef.current) noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      if (!tagServiceRef.current) tagServiceRef.current = createTagService(drizzleDb);
      if (!tagRelationServiceRef.current) tagRelationServiceRef.current = createTagRelationService(drizzleDb);
    }
  }, [drizzleDb]);

  const [choice, setChoice] = useState<ChoiceSelect | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [choiceNoteRelations, setChoiceNoteRelations] = useState<NoteRelation[]>([]);
  const [choiceTags, setChoiceTags] = useState<TagSelect[]>([]);
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
  });

  const fetchChoice = useCallback(async () => {
    if (!choiceServiceRef.current) {
      console.warn('Choice service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedChoice = await choiceServiceRef.current.getById(choiceId);
      if (fetchedChoice && !fetchedChoice.isDeleted) {
        setChoice(fetchedChoice);
        setHeaderTitle(fetchedChoice.text || t('choice_details_title')); // Use text
      } else if (fetchedChoice && fetchedChoice.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('choice_not_found'));
        setHeaderTitle(t('choice_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch choice details:', err);
      setError(t('failed_to_load_choice'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [choiceId, navigation, t]);

  const fetchNotesForStory = useCallback(async () => {
    if (!noteServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedNotes = await noteServiceRef.current.getNotesByStoryId(selectedStory.id);
      setAllNotes(fetchedNotes);
    } catch (err) {
      console.error('Failed to fetch notes for story:', err);
    }
  }, [selectedStory?.id]);

  const fetchNoteRelationsForChoice = useCallback(async () => {
    if (!noteRelationServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, choiceId, 'Choice');
      setChoiceNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for choice:', err);
    }
  }, [selectedStory?.id, choiceId]);

  const fetchTagsForChoice = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id) return;
    try {
      const fetchedTags = await tagRelationServiceRef.current.getTagsForEntity(selectedStory.id, choiceId, 'Choice');
      setChoiceTags(fetchedTags);
    } catch (err) {
      console.error('Failed to fetch tags for choice:', err);
    }
  }, [selectedStory?.id, choiceId]);

  const handleChoiceChange = useCallback(async (changedStoryId: string, changedChoiceId: string) => {
    if (changedChoiceId === choiceId && choiceServiceRef.current) {
      const updatedChoice = await choiceServiceRef.current.getById(choiceId);
      if (!updatedChoice || updatedChoice.isDeleted) {
        navigation.goBack();
      } else {
        setChoice(updatedChoice);
        setHeaderTitle(updatedChoice.text || t('choice_details_title')); // Use text
      }
    }
  }, [choiceId, navigation, t]);

  const handleNoteChange = useCallback(() => {
    fetchNotesForStory();
  }, [fetchNotesForStory]);

  const handleNoteRelationChange = useCallback(() => {
    fetchNoteRelationsForChoice();
  }, [fetchNoteRelationsForChoice]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === choiceId) fetchTagsForChoice();
  }, [choiceId, fetchTagsForChoice]);

  useEffect(() => {
    fetchChoice();
    entityEventEmitter.on('choice_changed', handleChoiceChange);
    entityEventEmitter.on('note_changed', handleNoteChange);
    entityEventEmitter.on('note_relation_changed', handleNoteRelationChange);
    entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);
    return () => {
      entityEventEmitter.off('choice_changed', handleChoiceChange);
      entityEventEmitter.off('note_changed', handleNoteChange);
      entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
      entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
    };
  }, [choiceId, fetchChoice, handleChoiceChange, handleNoteChange, handleNoteRelationChange, handleTagRelationChange]);

  useEffect(() => {
    if (choice) {
      fetchNotesForStory();
      fetchNoteRelationsForChoice();
      fetchTagsForChoice();
    }
  }, [choice, fetchNotesForStory, fetchNoteRelationsForChoice, fetchTagsForChoice]);

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await noteRelationServiceRef.current.saveNoteRelation(userId, relation);
      setChoiceNoteRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        }
        return [...prev, savedRelation];
      });
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, choiceId);
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
        setChoiceNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, choiceId);
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
    <TouchableOpacity onPress={() => navigation.navigate('ChoiceForm', { choiceId })} style={{ marginRight: 15 }}>
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, choiceId, colors.text]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return <View style={[styles.container, styles.centerContent]}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.detailText}>{t('loading_choice_details')}</Text></View>;
  }
  if (error) {
    return <View style={[styles.container, styles.centerContent]}><Text style={[styles.detailText, styles.errorText]}>{error}</Text><View style={styles.buttonContainer}><Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} /></View></View>;
  }
  if (!choice) {
    return <View style={[styles.container, styles.centerContent]}><Text style={[styles.detailText, styles.errorText]}>{t('choice_data_missing')}</Text><View style={styles.buttonContainer}><Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} /></View></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>{choice.text}</Text>

      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
      <NoteManager
        noteRelations={choiceNoteRelations}
        availableNotes={allNotes}
        onSave={handleSaveNoteRelation}
        onDelete={handleDeleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={choiceId}
        currentEntityType="Choice"
      />

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={choiceTags} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ChoiceDetailScreen;