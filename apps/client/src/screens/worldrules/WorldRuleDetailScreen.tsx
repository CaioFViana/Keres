import { Ionicons } from '@expo/vector-icons';
import { Note, NoteRelation } from '@keres/shared/entities/Note';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NoteManager from '../../components/NoteManager/NoteManager';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { WorldRuleWithTags } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { createNoteRelationService, NoteRelationServiceInterface } from '../../services/NoteRelationService';
import { createNoteService, NoteService } from '../../services/NoteService';
import { createTagRelationService } from '../../services/TagRelationService';
import { createTagService } from '../../services/TagService';
import { createWorldRuleService } from '../../services/WorldRuleService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { WorldRulesScreenNavigationProp } from './WorldRuleListScreen';

// Define the parameter list for this screen
export type WorldRuleDetailScreenParamList = {
  WorldRuleDetail: { worldRuleId: string };
};

type WorldRuleDetailScreenRouteProp = RouteProp<WorldRuleDetailScreenParamList, 'WorldRuleDetail'>;

const WorldRuleDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<WorldRulesScreenNavigationProp>();
  const route = useRoute<WorldRuleDetailScreenRouteProp>();
  const { worldRuleId } = route.params;

  const drizzleDb = useDrizzle();
  const worldRuleServiceRef = useRef<ReturnType<typeof createWorldRuleService> | null>(null);
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);
  const noteServiceRef = useRef<NoteService | null>(null); // Ref for NoteService
  const noteRelationServiceRef = useRef<NoteRelationServiceInterface | null>(null); // Ref for NoteRelationService
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { selectedStory } = useStoryStore();

  // Initialize services only once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!worldRuleServiceRef.current) {
        worldRuleServiceRef.current = createWorldRuleService(drizzleDb);
      }
      if (!tagServiceRef.current) {
        tagServiceRef.current = createTagService(drizzleDb);
      }
      if (!tagRelationServiceRef.current) {
        tagRelationServiceRef.current = createTagRelationService(drizzleDb);
      }
      if (!noteServiceRef.current) {
        noteServiceRef.current = createNoteService(drizzleDb);
      }
      if (!noteRelationServiceRef.current) {
        noteRelationServiceRef.current = createNoteRelationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [worldRule, setWorldRule] = useState<WorldRuleWithTags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));
  const [allNotes, setAllNotes] = useState<Note[]>([]); // State for all notes in story
  const [worldRuleNoteRelations, setWorldRuleNoteRelations] = useState<NoteRelation[]>([]); // State for note relations

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

  const fetchWorldRule = useCallback(async () => {
    if (!worldRuleServiceRef.current) {
      console.warn('WorldRule service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedWorldRule = await worldRuleServiceRef.current.getById(worldRuleId);
      if (fetchedWorldRule && !fetchedWorldRule.isDeleted) {
        setWorldRule(fetchedWorldRule);
        setHeaderTitle(fetchedWorldRule.title || t('world_rule_details_title'));
      } else if (fetchedWorldRule && fetchedWorldRule.isDeleted) {
        navigation.goBack()
      }
      else {
        setError(t('world_rule_not_found'));
        setHeaderTitle(t('world_rule_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch world rule details:', err);
      setError(t('failed_to_load_world_rule'));
      setHeaderTitle(t('error'));
    }
    finally {
      setLoading(false);
    }
  }, [worldRuleId, setWorldRule, setLoading, setError, setHeaderTitle, navigation, worldRuleServiceRef.current, t]);

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

  const fetchNoteRelationsForWorldRule = useCallback(async () => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !worldRuleId) {
      setWorldRuleNoteRelations([]);
      return;
    }
    try {
      const fetchedNoteRelations = await noteRelationServiceRef.current.getRelationsForEntity(selectedStory.id, worldRuleId, 'WorldRule');
      setWorldRuleNoteRelations(fetchedNoteRelations);
    } catch (err) {
      console.error('Failed to fetch note relations for world rule:', err);
    }
  }, [selectedStory?.id, worldRuleId, noteRelationServiceRef.current]);

  const handleWorldRuleChange = useCallback(async (changedStoryId: string, changedWorldRuleId: string) => {
    if (changedWorldRuleId === worldRuleId) {
      if (worldRuleServiceRef.current) {
        const updatedWorldRule = await worldRuleServiceRef.current.getById(worldRuleId);
        if (!updatedWorldRule || updatedWorldRule.isDeleted) {
          navigation.goBack();
        } else {
          setWorldRule(updatedWorldRule);
          setHeaderTitle(updatedWorldRule.title || t('world_rule_details_title'));
        }
      }
    }
  }, [worldRuleId, navigation, setWorldRule, setHeaderTitle, worldRuleServiceRef.current, t]);

  const handleTagRelationChange = useCallback(async (changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === worldRuleId && worldRuleServiceRef.current) {
      const updatedWorldRule = await worldRuleServiceRef.current.getById(worldRuleId);
      if (updatedWorldRule && !updatedWorldRule.isDeleted) {
        setWorldRule(updatedWorldRule);
      }
    }
  }, [worldRuleId, setWorldRule, worldRuleServiceRef.current]);

  const handleNoteChange = useCallback((changedStoryId: string, changedNoteId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchNotesForStory();
    }
  }, [selectedStory?.id, fetchNotesForStory]);

  const handleNoteRelationChange = useCallback((changedStoryId: string, changedNoteRelationId: string) => {
    if (selectedStory?.id === changedStoryId) {
      fetchNoteRelationsForWorldRule();
    }
  }, [selectedStory?.id, fetchNoteRelationsForWorldRule]);

  useEffect(() => {
    if (worldRuleServiceRef.current) {
      fetchWorldRule();
      entityEventEmitter.on('worldrule_changed', handleWorldRuleChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);
      entityEventEmitter.on('note_changed', handleNoteChange);
      entityEventEmitter.on('note_relation_changed', handleNoteRelationChange);

      return () => {
        entityEventEmitter.off('worldrule_changed', handleWorldRuleChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
        entityEventEmitter.off('note_changed', handleNoteChange);
        entityEventEmitter.off('note_relation_changed', handleNoteRelationChange);
      };
    }
  }, [worldRuleId, fetchWorldRule, handleWorldRuleChange, handleTagRelationChange, handleNoteChange, handleNoteRelationChange, worldRuleServiceRef.current]);

  useEffect(() => {
    if (worldRule) {
      fetchNotesForStory();
      fetchNoteRelationsForWorldRule();
    }
  }, [worldRule, fetchNotesForStory, fetchNoteRelationsForWorldRule]);

  const handleSaveNoteRelation = async (relation: NoteRelation) => {
    if (!noteRelationServiceRef.current || !selectedStory?.id || !userId) {
      Alert.alert(t('error'), t('service_not_initialized'));
      return;
    }
    try {
      const savedRelation = await noteRelationServiceRef.current.saveNoteRelation(userId, relation);
      setWorldRuleNoteRelations(prev => {
        const existingIndex = prev.findIndex(r => r.id === savedRelation.id);
        if (existingIndex > -1) {
          return prev.map((r, index) => (index === existingIndex ? savedRelation : r));
        } else {
          return [...prev, savedRelation];
        }
      });
      entityEventEmitter.emit('note_relation_changed', selectedStory.id, worldRuleId);
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
        setWorldRuleNoteRelations(prev => prev.filter(r => r.id !== relationId));
        entityEventEmitter.emit('note_relation_changed', selectedStory.id, worldRuleId);
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
      onPress={() => navigation.navigate('WorldRuleForm', { worldRuleId: worldRuleId })}
      style={{ marginRight: 15 }}
    >
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, worldRuleId, colors.text]);

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
        <Text style={styles.detailText}>{t('loading_world_rule_details')}</Text>
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

  if (!worldRule) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{t('world_rule_data_missing')}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>{worldRule.title}</Text>
      
      {worldRule.description && (
        <Text style={styles.detailText}>{t('description')}: {worldRule.description}</Text>
      )}

      {worldRule.extraNotes && (
        <Text style={styles.detailText}>{t('extra_notes')}: {worldRule.extraNotes}</Text>
      )}

      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
      <NoteManager
        noteRelations={worldRuleNoteRelations}
        availableNotes={allNotes}
        onSave={handleSaveNoteRelation}
        onDelete={handleDeleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={worldRuleId}
        currentEntityType="WorldRule"
      />

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={worldRule.tags} />
      
      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default WorldRuleDetailScreen;