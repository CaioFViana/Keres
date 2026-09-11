import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import CommentList from '@/src/components/features/comments/CommentList/CommentList';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useNavigateToEntityDetail } from '../../hooks/useNavigateToEntityDetail';
import type { CommentSelect } from '../../db/schema';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import type { NavigableEntityType } from '../../utils/entityNavigation';

/**
 * A comprehensive list of every comment in the current story, cross-entity - modelled on
 * `OperationLogListScreen`. Tapping an item navigates to the target entity (v1: it only navigates to the
 * detail screen, it does not open the specific field's modal - see the implementation plan).
 */
const CommentListScreen: React.FC = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigateToDetail = useNavigateToEntityDetail();
  const { selectedStory } = useStoryStore();

  useScreenHeader({
    target: 'parent',
    title: t('comments_title'),
  });

  const handlePressComment = useCallback(
    (comment: CommentSelect) => {
      navigateToDetail(comment.entityType as NavigableEntityType, comment.entityId);
    },
    [navigateToDetail],
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    noStoryContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noStoryText: { fontSize: 18, color: colors.textSecondary },
  });

  if (!selectedStory?.id) {
    return (
      <View style={[styles.container, styles.noStoryContainer]}>
        <Text style={styles.noStoryText}>{t('no_story_selected')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CommentList storyId={selectedStory.id} pageSize={20} onPressItem={handlePressComment} />
    </View>
  );
};

export default CommentListScreen;
