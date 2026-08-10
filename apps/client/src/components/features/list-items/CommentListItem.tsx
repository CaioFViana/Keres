import { Ionicons } from '@expo/vector-icons';
import { OperationLogEntityType } from '@keres/shared';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CommentSelect } from '../../../db/schema';
import { useEntityName } from '../../../hooks/useEntityName';
import { useTheme } from '../../../theme';
import { CommentCriticality, CRITICALITY_ICONS } from '../../../utils/commentCriticality';

interface CommentListItemProps {
  comment: CommentSelect;
  onPress?: (comment: CommentSelect) => void;
}

const CommentListItem: React.FC<CommentListItemProps> = ({ comment, onPress }) => {
  const { colors } = useTheme();
  const { entityName } = useEntityName(comment.entityType as OperationLogEntityType, comment.entityId, comment.storyId);

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
    entityName: { fontSize: 15, fontWeight: 'bold', color: colors.text, marginLeft: 6, flexShrink: 1 },
    fieldLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    commentText: { fontSize: 14, color: colors.text, marginTop: 6 },
    timestamp: { fontSize: 12, color: colors.textSecondary, marginTop: 8, textAlign: 'right' },
  });

  const fieldLabel = comment.fieldKey || comment.fieldId || '';

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress ? () => onPress(comment) : undefined}
      disabled={!onPress}
    >
      <View style={styles.headerRow}>
        <Ionicons
          name={CRITICALITY_ICONS[comment.criticality as CommentCriticality] ?? CRITICALITY_ICONS[3]}
          size={18}
          color={colors.primary}
        />
        <Text style={styles.entityName} numberOfLines={1}>{entityName || comment.entityType}</Text>
      </View>
      {!!fieldLabel && <Text style={styles.fieldLabel}>{fieldLabel}</Text>}
      <Text style={styles.commentText} numberOfLines={3}>{comment.commentText}</Text>
      <Text style={styles.timestamp}>{comment.createdAt.toLocaleString()}</Text>
    </TouchableOpacity>
  );
};

export default CommentListItem;
