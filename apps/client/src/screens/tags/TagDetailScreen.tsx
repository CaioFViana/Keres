import Button from '@/src/components/common/controls/Button/Button';
import { createCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import EntityMetadata from '@/src/components/features/mentions/EntityMetadataWithBacklinks';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import type { RelatedEntityItem } from '@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList';
import RelatedEntitiesList from '@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import type { TagRelation } from '@keres/shared/entities/Tag'; // Import TagRelation
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { TagSelect } from '../../db/schema'; // Import TagSelect
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityInitialLoad } from '../../hooks/useEntityRefreshLifecycle';
import { useEntityComments } from '../../hooks/useEntityComments';
import { EntityService } from '../../services/EntityService'; // Import EntityService
import { createTagRelationService } from '../../services/storymanagement/TagRelationService'; // Import createTagRelationService
import { createTagService } from '../../services/storymanagement/TagService'; // Import createTagService
import { useStoryStore } from '../../state/storyStore'; // Import useStoryStore
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import type { TagsScreenNavigationProp } from './TagListScreen';

// Define the parameter list for this screen
export type TagDetailScreenParamList = {
  TagDetail: { tagId: string };
};

type TagDetailScreenRouteProp = RouteProp<TagDetailScreenParamList, 'TagDetail'>;

const TagDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation<TagsScreenNavigationProp>();
  const route = useRoute<TagDetailScreenRouteProp>();
  const { tagId } = route.params;

  const drizzleDb = useDrizzle();
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);
  const { t } = useTranslation(); // Initialize useTranslation
  const { selectedStory } = useStoryStore();

  // Initialize tagService only once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!tagServiceRef.current) {
        tagServiceRef.current = createTagService(drizzleDb);
      }
      if (!tagRelationServiceRef.current) {
        tagRelationServiceRef.current = createTagRelationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [tag, setTag] = useState<TagSelect | null>(null);
  const {
    canComment,
    isStoryOwner,
    currentUserId,
    commentsByField,
    addComment,
    deleteComment,
    updateComment,
  } = useEntityComments(selectedStory?.id, 'Tag', tagId);
  const [allTagRelations, setAllTagRelations] = useState<TagRelation[]>([]);
  const [groupedEntities, setGroupedEntities] = useState<Record<string, RelatedEntityItem[]>>({
    chapter: [],
    character: [],
    choice: [],
    item: [],
    itemjourney: [],
    location: [],
    note: [],
    operationlog: [],
    scene: [],
    story: [],
    suggestion: [], // Added missing suggestion
    tag: [],
    user: [],
    worldrule: [],
    characterrelation: [],
    noterelation: [],
    tagrelation: [],
    characterscene: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  // Move styles declaration to the top
  const styles = StyleSheet.create({
    detailText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
    },
    colorDisplayContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    colorCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      marginRight: 10,
    },
  });

  const fetchTag = useCallback(async () => {
    if (!tagServiceRef.current) {
      console.warn('Tag service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedTag = await tagServiceRef.current.getById(tagId);
      if (fetchedTag && !fetchedTag.isDeleted) {
        setTag(fetchedTag);
        setHeaderTitle(fetchedTag.name || t('tag_details_title'));
      } else if (fetchedTag && fetchedTag.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('tag_not_found'));
        setHeaderTitle(t('tag_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch tag details:', err);
      setError(t('failed_to_load_tag'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [tagId, setTag, setLoading, setError, setHeaderTitle, navigation, t]);

  const fetchTagRelations = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id) {
      console.warn('Tag relation service or story not initialized.');
      return;
    }
    try {
      const relations = await tagRelationServiceRef.current.getRelationsForTag(
        selectedStory.id,
        tagId,
      );
      setAllTagRelations(relations);
    } catch (err) {
      console.error('Failed to fetch tag relations:', err);
    }
  }, [tagId, selectedStory?.id]);

  const processTagRelations = useCallback(async () => {
    if (!drizzleDb || !selectedStory?.id) return;

    const newGroupedEntities: Record<string, RelatedEntityItem[]> = {
      chapter: [],
      character: [],
      choice: [],
      item: [],
      itemjourney: [],
      location: [],
      note: [],
      operationlog: [],
      scene: [],
      story: [],
      suggestion: [],
      tag: [],
      user: [],
      worldrule: [],
      characterrelation: [],
      noterelation: [],
      tagrelation: [],
      characterscene: [],
    };

    for (const relation of allTagRelations) {
      const entityName = await EntityService.getEntityIdentifier(
        drizzleDb,
        relation.relationType,
        relation.relationId,
        selectedStory.id,
        t,
      );
      if (entityName) {
        newGroupedEntities[relation.relationType.toLowerCase()].push({
          id: relation.relationId,
          name: entityName,
        });
      }
    }
    setGroupedEntities(newGroupedEntities);
  }, [allTagRelations, drizzleDb, selectedStory?.id, t]);

  const handleTagChange = useCallback(
    async (changedStoryId: string, changedTagId: string) => {
      if (changedTagId === tagId) {
        // Re-fetch the tag to get the latest status
        if (tagServiceRef.current) {
          const updatedTag = await tagServiceRef.current.getById(tagId);
          if (!updatedTag || updatedTag.isDeleted) {
            navigation.goBack(); // Tag was deleted or no longer found
          } else {
            setTag(updatedTag); // Update state with latest tag data
            setHeaderTitle(updatedTag.name || t('tag_details_title'));
          }
        }
        fetchTagRelations(); // Also refetch relations if the tag itself changed
      }
    },
    [tagId, navigation, setTag, setHeaderTitle, t, fetchTagRelations],
  );

  const handleTagRelationChange = useCallback(
    (changedStoryId: string, changedTagId: string) => {
      if (changedTagId === tagId) {
        fetchTagRelations(); // Refetch relations if a tag relation changed
      }
    },
    [tagId, fetchTagRelations],
  );

  const loadInitialTagData = useCallback(() => {
    if (tagServiceRef.current && selectedStory?.id) {
      void fetchTag();
      void fetchTagRelations();
    }
  }, [fetchTag, fetchTagRelations, selectedStory?.id]);

  useEntityInitialLoad(loadInitialTagData);

  // Only subscribe here; a callback identity change must not reload the tag.
  useEffect(() => {
    if (tagServiceRef.current && selectedStory?.id) {
      entityEventEmitter.on('tag_changed', handleTagChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);

      return () => {
        entityEventEmitter.off('tag_changed', handleTagChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
      };
    }
  }, [handleTagChange, selectedStory?.id, handleTagRelationChange]);

  useEffect(() => {
    if (allTagRelations.length > 0 && selectedStory?.id) {
      processTagRelations();
    }
  }, [allTagRelations, selectedStory?.id, processTagRelations]);

  useScreenHeader({
    target: 'parent',
    title: headerTitle,
    actions: [
      {
        id: 'action-0',
        icon: 'pencil-outline',
        label: t('edit'),
        onPress: () => navigation.navigate('TagForm', { tagId: tagId }),
      },
    ],
  });

  if (loading) {
    return <ScreenLoading padded message={t('loading_tag_details')} />;
  }

  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }

  if (!tag) {
    return (
      <ScreenError padded message={t('tag_data_missing')} onGoBack={() => navigation.goBack()} />
    );
  }

  const commentField = createCommentFieldBindings({
    storyId: tag.storyId,
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
      title={tag.name}
      footer={
        <>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </>
      }
    >
      {tag.color && (
        <View style={styles.colorDisplayContainer}>
          <View style={[styles.colorCircle, { backgroundColor: tag.color }]} />
          <Text style={styles.detailText}>
            {t('color')}: {tag.color}
          </Text>
        </View>
      )}

      <CommentableDetailField
        {...commentField('extraNotes', tag.extraNotes || t('common_na'))}
        label={t('extra_notes')}
      />

      <RelatedEntitiesList
        title={t('tagged_entities_title')}
        noItemsMessage={t('no_entities_tagged')}
        groupedEntities={groupedEntities}
      />

      <EntityMetadata version={tag.version} createdAt={tag.createdAt} updatedAt={tag.updatedAt} />
      <FavoritedByList storyId={tag.storyId} entityId={tagId} entityType="Tag" />
    </DetailContainer>
  );
};

export default TagDetailScreen;
