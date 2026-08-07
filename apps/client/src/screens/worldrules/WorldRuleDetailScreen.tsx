import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import CustomAttributeDetailFields from '../../components/common/CustomAttributeFields/CustomAttributeDetailFields';
import DetailField from '../../components/common/DetailField/DetailField';
import EntityMetadata from '../../components/common/EntityMetadata/EntityMetadata';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import NoteManager from '../../components/NoteManager';
import { useDrizzle } from '../../db';
import { WorldRuleWithTags } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createWorldRuleService } from '../../services/storymanagement/WorldRuleService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
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
  const scrollBottomPadding = useFormScrollBottomPadding();

  // Initialize services only once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb && !worldRuleServiceRef.current) {
      worldRuleServiceRef.current = createWorldRuleService(drizzleDb);
    }
  }, [drizzleDb]);

  const [worldRule, setWorldRule] = useState<WorldRuleWithTags | null>(null);
  const { canEdit } = useStoryRole(worldRule?.storyId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const {
    allNotes,
    noteRelations: worldRuleNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'WorldRule', entityId: worldRuleId });

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
    canEdit ? (
      <TouchableOpacity
        onPress={() => navigation.navigate('WorldRuleForm', { worldRuleId: worldRuleId })}
        style={{ marginRight: 15 }}
      >
        <Ionicons name="pencil-outline" size={24} color={colors.text} />
      </TouchableOpacity>
    ) : null
  ), [navigation, worldRuleId, colors.text, canEdit]);

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
    return <ScreenLoading padded message={t('loading_world_rule_details')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!worldRule) {
    return <ScreenError padded message={t('world_rule_data_missing')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScrollView style={commonContainerStyles.container} contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
      <TagChipList tags={worldRule.tags} />

      <DetailField label={t('description')} value={worldRule.description || t('common_na')} />

      <CustomAttributeDetailFields storyId={worldRule.storyId} entityType="WorldRule" entityId={worldRuleId} />

      <DetailField label={t('extra_notes')} value={worldRule.extraNotes || t('common_na')} />

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

      <EntityMetadata version={worldRule.version} createdAt={worldRule.createdAt} updatedAt={worldRule.updatedAt} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default WorldRuleDetailScreen;