import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NoteManager from '../../components/NoteManager';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { WorldRuleWithTags } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { createWorldRuleService } from '../../services/storymanagement/WorldRuleService';
import { useStoryStore } from '../../state/storyStore';
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
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();

  // Initialize services only once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb && !worldRuleServiceRef.current) {
      worldRuleServiceRef.current = createWorldRuleService(drizzleDb);
    }
  }, [drizzleDb]);

  const [worldRule, setWorldRule] = useState<WorldRuleWithTags | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const {
    allNotes,
    noteRelations: worldRuleNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'WorldRule', entityId: worldRuleId });

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
  }, [worldRuleId, setWorldRule, setLoading, setError, setHeaderTitle, navigation, t]);

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
  }, [worldRuleId, navigation, setWorldRule, setHeaderTitle, t]);

  const handleTagRelationChange = useCallback(async (changedStoryId: string, changedEntityId: string) => {
    if (changedEntityId === worldRuleId && worldRuleServiceRef.current) {
      const updatedWorldRule = await worldRuleServiceRef.current.getById(worldRuleId);
      if (updatedWorldRule && !updatedWorldRule.isDeleted) {
        setWorldRule(updatedWorldRule);
      }
    }
  }, [worldRuleId, setWorldRule]);

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    if (worldRuleServiceRef.current) {
      fetchWorldRule();
      entityEventEmitter.on('worldrule_changed', handleWorldRuleChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);

      return () => {
        entityEventEmitter.off('worldrule_changed', handleWorldRuleChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
      };
    }
  }, [worldRuleId, fetchWorldRule, handleWorldRuleChange, handleTagRelationChange]);

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
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
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