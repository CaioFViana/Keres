import { useFocusEffect, useNavigation } from '@react-navigation/native';
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
import { setDocumentTitle } from '../../utils/documentTitle';
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
  const navigation = useNavigation();
  const navigateToDetail = useNavigateToEntityDetail();
  const { selectedStory } = useStoryStore();

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: t('comments_title') });
      setDocumentTitle(t('comments_title'));
    }, [navigation, t]),
  );

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
