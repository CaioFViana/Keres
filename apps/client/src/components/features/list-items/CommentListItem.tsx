import { Ionicons } from '@expo/vector-icons';
import type { OperationLogEntityType } from '@keres/shared';
import { eq } from 'drizzle-orm';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import { useDrizzle } from '../../../db';
import type { CommentSelect } from '../../../db/schema';
import { servers, stories } from '../../../db/schema';
import { useCommentFieldLabel } from '../../../hooks/useCommentFieldLabel';
import { useEntityName } from '../../../hooks/useEntityName';
import type { ResolvedUserProfile } from '../../../hooks/useUserProfileResolver';
import { useUserProfileResolver } from '../../../hooks/useUserProfileResolver';
import { useTheme } from '../../../theme';
import type { CommentCriticality } from '../../../utils/commentCriticality';
import { CRITICALITY_ICONS } from '../../../utils/commentCriticality';

interface CommentListItemProps {
  comment: CommentSelect;
  onPress?: (comment: CommentSelect) => void;
}

const CommentListItem: React.FC<CommentListItemProps> = ({ comment, onPress }) => {
  const { colors } = useTheme();
  const db = useDrizzle();
  const resolveProfile = useUserProfileResolver();
  const { entityName } = useEntityName(
    comment.entityType as OperationLogEntityType,
    comment.entityId,
    comment.storyId,
  );
  const fieldLabel = useCommentFieldLabel(comment.entityType, comment.fieldKey, comment.fieldId);
  const [author, setAuthor] = useState<ResolvedUserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const story = await db.query.stories.findFirst({
        where: eq(stories.id, comment.storyId),
        columns: { serverId: true },
      });
      const storyServer = story?.serverId
        ? await db.query.servers.findFirst({ where: eq(servers.id, story.serverId) })
        : undefined;
      const profile = await resolveProfile(comment.authorUserId, storyServer);
      if (!cancelled) setAuthor(profile);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, comment.storyId, comment.authorUserId, resolveProfile]);

  const styles = StyleSheet.create({
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
    fieldLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    commentText: { fontSize: 14, color: colors.text, marginTop: 6 },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    authorRow: { flexDirection: 'row', alignItems: 'center' },
    authorName: { fontSize: 12, color: colors.textSecondary, marginLeft: 6 },
    timestamp: { fontSize: 12, color: colors.textSecondary },
  });

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

export default CommentListItem;
