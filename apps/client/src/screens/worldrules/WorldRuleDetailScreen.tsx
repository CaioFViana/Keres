import Button from '@/src/components/common/controls/Button/Button';
import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import TagList from '@/src/components/common/display/TagList/TagList';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import CustomAttributeDetailFields from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeDetailFields';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import EntityGalleryManager from '@/src/components/features/gallery/GalleryManager/EntityGalleryManager';
import NoteManager from '@/src/components/features/notes/NoteManager';
import SeeAlsoManager from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDrizzle } from '../../db';
import type { WorldRuleWithTags } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityInitialLoad } from '../../hooks/useEntityRefreshLifecycle';
import { useEntityComments } from '../../hooks/useEntityComments';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { useOpenGalleryMediaViewer } from '../../hooks/useOpenGalleryMediaViewer';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createWorldRuleService } from '../../services/storymanagement/WorldRuleService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useVocabularyEntityCopy } from '../../vocabulary/useVocabularyEntityCopy';
import type { WorldRulesScreenNavigationProp } from './WorldRuleListScreen';

// Define the parameter list for this screen
export type WorldRuleDetailScreenParamList = {
  WorldRuleDetail: { worldRuleId: string };
};

type WorldRuleDetailScreenRouteProp = RouteProp<WorldRuleDetailScreenParamList, 'WorldRuleDetail'>;

const WorldRuleDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  useTheme();
  const navigation = useNavigation<WorldRulesScreenNavigationProp>();
  const openGalleryMediaViewer = useOpenGalleryMediaViewer();
  const route = useRoute<WorldRuleDetailScreenRouteProp>();
  const { worldRuleId } = route.params;

  const drizzleDb = useDrizzle();
  const worldRuleServiceRef = useRef<ReturnType<typeof createWorldRuleService> | null>(null);
  const { t } = useTranslation();
  const copy = useVocabularyEntityCopy('WorldRule');
  const { selectedStory } = useStoryStore();

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
        setHeaderTitle(fetchedWorldRule.title || copy.detailsTitle);
      } else if (fetchedWorldRule && fetchedWorldRule.isDeleted) {
        navigation.goBack();
      } else {
        setError(copy.notFound);
        setHeaderTitle(copy.notFound);
      }
    } catch (err) {
      console.error('Failed to fetch world rule details:', err);
      setError(copy.failedToLoad);
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [worldRuleId, setWorldRule, setLoading, setError, setHeaderTitle, navigation, copy, t]);

  const handleWorldRuleChange = useCallback(
    async (changedStoryId: string, changedWorldRuleId: string) => {
      if (changedWorldRuleId === worldRuleId) {
        if (worldRuleServiceRef.current) {
          const updatedWorldRule = await worldRuleServiceRef.current.getById(worldRuleId);
          if (!updatedWorldRule || updatedWorldRule.isDeleted) {
            navigation.goBack();
          } else {
            setWorldRule(updatedWorldRule);
            setHeaderTitle(updatedWorldRule.title || copy.detailsTitle);
          }
        }
      }
    },
    [worldRuleId, navigation, setWorldRule, setHeaderTitle, copy],
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

  useEntityInitialLoad(fetchWorldRule);

  // Subscription lifecycle is independent from loading the entity.
  useEffect(() => {
    if (worldRuleServiceRef.current) {
      entityEventEmitter.on('worldrule_changed', handleWorldRuleChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);

      return () => {
        entityEventEmitter.off('worldrule_changed', handleWorldRuleChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
      };
    }
  }, [handleWorldRuleChange, handleTagRelationChange]);

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('WorldRuleForm', { worldRuleId: worldRuleId }),
        visible: !!canEdit,
      },
    ],
  });

  if (loading) {
    return <ScreenLoading padded message={copy.loadingDetails} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!worldRule) {
    return <ScreenError padded message={copy.dataMissing} onGoBack={() => navigation.goBack()} />;
  }

  const commentField = createCommentFieldBindings({
    storyId: worldRule.storyId,
    canComment: canComment,
    isStoryOwner: isStoryOwner,
    currentUserId: currentUserId,
    onDeleteComment: deleteComment,
    onUpdateComment: updateComment,
    commentsByField,
    addComment,
  });

  return (
    <DetailContainer
      title={worldRule.title}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      <TagList tags={worldRule.tags} variant="chip" emptyMessage={t('no_tags_found')} />

      <CommentableDetailField
        {...commentField('section', t(`world_piece_section_${worldRule.section}`))}
        label={t('world_piece_section')}
      />

      {(['type', 'category', 'behavior', 'usability', 'danger'] as const).map((field) => (
        <CommentableDetailField
          {...commentField(field, worldRule[field] || t('common_na'))}
          key={field}
          label={t(field === 'category' ? 'category' : `world_piece_${field}`)}
        />
      ))}

      <CommentableDetailField
        {...commentField('description', worldRule.description || t('common_na'))}
        label={t('description')}
      />

      <CustomAttributeDetailFields
        storyId={worldRule.storyId}
        entityType="WorldRule"
        entityId={worldRuleId}
      />

      <CommentableDetailField
        {...commentField('extraNotes', worldRule.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <ScreenSection title={t('media_section_title')} />
      <EntityGalleryManager
        ownerId={worldRuleId}
        ownerType="WorldRule"
        onPressMedia={openGalleryMediaViewer}
        editable={canEdit}
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
        entityType="WorldRule"
        entityId={worldRule.id}
      />
      <FavoritedByList storyId={worldRule.storyId} entityId={worldRuleId} entityType="WorldRule" />
    </DetailContainer>
  );
};

export default WorldRuleDetailScreen;
