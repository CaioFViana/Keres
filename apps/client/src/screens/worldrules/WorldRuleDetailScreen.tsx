import EntityMetadata from '@/src/components/common/display/EntityMetadata/EntityMetadata';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp} from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { WorldRuleWithTags } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createWorldRuleService } from '../../services/storymanagement/WorldRuleService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { commonDetailStyleDefs, getCommonContainerStyles } from '../../theme/commonStyles';
import { setDocumentTitle } from '../../utils/documentTitle';
import { entityEventEmitter } from '../../utils/EventEmitter';
import type { WorldRulesScreenNavigationProp } from './WorldRuleListScreen';

// Define the parameter list for this screen
export type WorldRuleDetailScreenParamList = {
  WorldRuleDetail: { worldRuleId: string };
};

type WorldRuleDetailScreenRouteProp = RouteProp<WorldRuleDetailScreenParamList, 'WorldRuleDetail'>;

const WorldRuleDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
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
  const {
    commentsByField,
    canComment,
    isStoryOwner,
    currentUserId,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(worldRule?.storyId, 'WorldRule', worldRuleId);
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
    ...commonDetailStyleDefs(colors),
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
        navigation.goBack();
      } else {
        setError(t('world_rule_not_found'));
        setHeaderTitle(t('world_rule_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch world rule details:', err);
      setError(t('failed_to_load_world_rule'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [worldRuleId, setWorldRule, setLoading, setError, setHeaderTitle, navigation, t]);

  const handleWorldRuleChange = useCallback(
    async (changedStoryId: string, changedWorldRuleId: string) => {
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
    },
    [worldRuleId, navigation, setWorldRule, setHeaderTitle, t],
  );

  const handleTagRelationChange = useCallback(
    async (changedStoryId: string, changedEntityId: string) => {
      if (changedEntityId === worldRuleId && worldRuleServiceRef.current) {
        const updatedWorldRule = await worldRuleServiceRef.current.getById(worldRuleId);
        if (updatedWorldRule && !updatedWorldRule.isDeleted) {
          setWorldRule(updatedWorldRule);
        }
      }
    },
    [worldRuleId, setWorldRule],
  );

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

  const renderHeaderRight = useCallback(
    () =>
      canEdit ? (
        <TouchableOpacity
          onPress={() => navigation.navigate('WorldRuleForm', { worldRuleId: worldRuleId })}
          style={{ marginRight: 15 }}
        >
          <Ionicons name="pencil-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      ) : null,
    [navigation, worldRuleId, colors.text, canEdit],
  );

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: headerTitle,
        headerRight: renderHeaderRight,
      });
      setDocumentTitle(headerTitle);
    }, [navigation, headerTitle, renderHeaderRight]),
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading_world_rule_details')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!worldRule) {
    return (
      <ScreenError
        padded
        message={t('world_rule_data_missing')}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  return (
    <ScrollView
      style={commonContainerStyles.container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <TagList tags={worldRule.tags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        storyId={worldRule.storyId}
        label={t('description')}
        value={worldRule.description || t('common_na')}
        comments={commentsByField['description'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'description' },
            { ...input, contentSnapshot: worldRule.description || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />

      <CustomAttributeDetailFields
        storyId={worldRule.storyId}
        entityType="WorldRule"
        entityId={worldRuleId}
      />

      <CommentableDetailField
        storyId={worldRule.storyId}
        label={t('extra_notes')}
        value={worldRule.extraNotes || t('common_na')}
        comments={commentsByField['extraNotes'] ?? []}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onAddComment={(input) =>
          addComment(
            { fieldKey: 'extraNotes' },
            { ...input, contentSnapshot: worldRule.extraNotes || t('common_na') },
          )
        }
        onDeleteComment={deleteComment}
        onUpdateComment={updateComment}
      />

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

      <SeeAlsoManager
        storyId={worldRule.storyId}
        entityType="WorldRule"
        entityId={worldRuleId}
        editable={false}
      />

      <EntityMetadata
        version={worldRule.version}
        createdAt={worldRule.createdAt}
        updatedAt={worldRule.updatedAt}
      />
      <FavoritedByList storyId={worldRule.storyId} entityId={worldRuleId} entityType="WorldRule" />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default WorldRuleDetailScreen;
