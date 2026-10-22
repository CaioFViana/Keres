import Button from '@/src/components/common/controls/Button/Button';
import { createEntityCommentFieldBindings } from '@/src/components/features/comments/CommentableDetailField/createCommentFieldBindings';
import type { OccurrenceTarget } from '@/src/utils/entity/occurrenceTarget';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import EntityMetadata from '@/src/mentions/EntityMetadataWithBacklinks';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import RelatedEntitiesList from '@/src/components/common/lists/RelatedEntitiesList/RelatedEntitiesList';
import CommentableDetailField from '@/src/components/features/comments/CommentableDetailField/CommentableDetailField';
import FavoritedByList from '@/src/components/features/favorites/FavoritedByList/FavoritedByList';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDetailRecord } from '@/src/hooks/lists/useDetailRecord';
import { useStoryEntities } from '@/src/hooks/lists/useStoryEntities';
import { useRelatedEntityGroups } from '@/src/hooks/relations/useRelatedEntityGroups';
import { useEntityComments } from '@/src/hooks/comments/useEntityComments';
import { useStoryStore } from '@/src/state/story/storyStore'; // Import useStoryStore
import type { ThemeColors } from '@/src/theme';
import { typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

import type { TagsScreenNavigationProp } from './TagListScreen';
import { useTagDetailServices } from './useTagDetailServices';

// Define the parameter list for this screen
export type TagDetailScreenParamList = {
  TagDetail: { tagId: string; occurrence?: OccurrenceTarget };
};

const TAG_RELATION_EVENTS = ['tag_relation_changed'] as const;

type TagDetailScreenRouteProp = RouteProp<TagDetailScreenParamList, 'TagDetail'>;

const TagDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const navigation = useNavigation<TagsScreenNavigationProp>();
  const route = useRoute<TagDetailScreenRouteProp>();
  const { tagId, occurrence } = route.params;

  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();

  const { tagService, tagRelationService } = useTagDetailServices();
  const {
    record: tag,
    loading,
    failure,
  } = useDetailRecord({
    id: tagId,
    load: tagService.getById,
    event: 'tag_changed',
    label: 'tag details',
    onGone: navigation.goBack,
  });
  const comments = useEntityComments(selectedStory?.id, 'Tag', tagId);
  const loadTagRelations = useMemo(
    () => (storyId: string) => tagRelationService.getRelationsForTag(storyId, tagId),
    [tagRelationService, tagId],
  );
  // A tag relation names the tagged entity, not the tag, so any change in the story may concern it.
  const tagRelations = useStoryEntities({
    storyId: selectedStory?.id,
    load: loadTagRelations,
    events: TAG_RELATION_EVENTS,
    label: 'tag relations',
  });
  const groupedEntities = useRelatedEntityGroups(selectedStory?.id, tagRelations);

  const styles = useThemedStyles(createStyles);

  const headerTitle = tag
    ? tag.name || t('tag_details_title')
    : failure === 'notFound'
      ? t('tag_not_found')
      : failure === 'failed'
        ? t('error')
        : t('loading');

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

  if (failure) {
    return (
      <ScreenError
        padded
        message={failure === 'notFound' ? t('tag_not_found') : t('failed_to_load_tag')}
        onGoBack={() => navigation.goBack()}
      />
    );
  }

  if (!tag) {
    return (
      <ScreenError padded message={t('tag_data_missing')} onGoBack={() => navigation.goBack()} />
    );
  }

  const commentField = createEntityCommentFieldBindings(tag.storyId, comments);

  return (
    <DetailContainer
      title={tag.name}
      landing={occurrence ?? null}
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    detailText: {
      ...typography.bodyLarge,
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

export default TagDetailScreen;
