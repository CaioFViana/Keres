import { Ionicons } from '@expo/vector-icons';
import type { OperationLogEntityType } from '@keres/shared';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import type { CommentSelect } from '../../../db/schema';
import { useAuthorProfiles } from '../../../hooks/useAuthorProfiles';
import { useCommentFieldLabel } from '../../../hooks/useCommentFieldLabel';
import { useEntityName } from '../../../hooks/useEntityName';
import { type ThemeColors, useTheme } from '../../../theme';
import { typography } from '../../../theme/tokens';
import { useThemedStyles } from '../../../theme/useThemedStyles';
import type { CommentCriticality } from '../../../utils/commentCriticality';
import { CRITICALITY_ICONS } from '../../../utils/commentCriticality';

interface CommentListItemProps {
  comment: CommentSelect;
  onPress?: (comment: CommentSelect) => void;
}

const CommentListItem: React.FC<CommentListItemProps> = ({ comment, onPress }) => {
  const { colors } = useTheme();
  const { entityName } = useEntityName(
    comment.entityType as OperationLogEntityType,
    comment.entityId,
    comment.storyId,
  );
  const fieldLabel = useCommentFieldLabel(comment.entityType, comment.fieldKey, comment.fieldId);
  const profiles = useAuthorProfiles(comment.storyId, [comment.authorUserId]);
  const author = profiles[comment.authorUserId] ?? null;

  const styles = useThemedStyles(createStyles);

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress ? () => onPress(comment) : undefined}
      disabled={!onPress}
    >
      <View style={styles.headerRow}>
        <Ionicons
          name={
            CRITICALITY_ICONS[comment.criticality as CommentCriticality] ?? CRITICALITY_ICONS[3]
          }
          size={18}
          color={colors.primary}
        />
        <Text style={styles.entityName} numberOfLines={1}>
          {entityName || comment.entityType}
        </Text>
      </View>
      {!!fieldLabel && <Text style={styles.fieldLabel}>{fieldLabel}</Text>}
      <Text style={styles.commentText} numberOfLines={3}>
        {comment.commentText}
      </Text>
      <View style={styles.footerRow}>
        <View style={styles.authorRow}>
          <Avatar
            seed={comment.authorUserId}
            color={author?.avatarColor}
            icon={author?.avatarIcon}
            size={20}
          />
          <Text style={styles.authorName} numberOfLines={1}>
            {author?.name || comment.authorUserId}
          </Text>
        </View>
        <Text style={styles.timestamp}>{comment.createdAt.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    cardContainer: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 15,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    entityName: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 6,
      flexShrink: 1,
    },
    fieldLabel: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
    commentText: { fontSize: 14, color: colors.text, marginTop: 6 },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    authorRow: { flexDirection: 'row', alignItems: 'center' },
    authorName: { ...typography.caption, color: colors.textSecondary, marginLeft: 6 },
    timestamp: { ...typography.caption, color: colors.textSecondary },
  });

export default CommentListItem;
