import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import type { CommentSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
import CommentThreadModal from '../CommentThreadModal/CommentThreadModal';

interface CommentableDetailFieldProps {
  storyId: string;
  label: string;
  value: string;
  onPress?: () => void;
  /** Passed through to `DetailField`, so the entity's own text does not link to itself. */
  mentionSourceId?: string;
  comments: CommentSelect[];
  canComment: boolean;
  isStoryOwner: boolean;
  currentUserId: string | null;
  onAddComment: (input: {
    commentText: string;
    excerptText: string | null;
    criticality: number;
  }) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onUpdateComment: (
    commentId: string,
    changes: { commentText?: string; criticality?: number },
  ) => Promise<void>;
}

/**
 * A drop-in for `<DetailField>` that adds a comment icon (with a counter) beside the
 * field, opening `CommentThreadModal` to see/add comments on that specific field.
 * Some fields interest nobody enough to comment on and nobody can add a comment -
 * in that case showing the button for nothing is not worth it, so it falls back to a plain `DetailField`.
 */
const CommentableDetailField: React.FC<CommentableDetailFieldProps> = ({
  mentionSourceId,
  storyId,
  label,
  value,
  onPress,
  comments,
  canComment,
  isStoryOwner,
  currentUserId,
  onAddComment,
  onDeleteComment,
  onUpdateComment,
}) => {
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const hasComments = comments.length > 0;

  if (!hasComments && !canComment) {
    return (
      <DetailField
        label={label}
        value={value}
        onPress={onPress}
        mentionSourceId={mentionSourceId}
      />
    );
  }

  const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start' },
    field: { flex: 1 },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
      marginTop: 18,
      paddingHorizontal: 4,
      paddingVertical: 2,
    },
    count: { fontSize: 12, color: colors.textSecondary, marginLeft: 3 },
  });

  return (
    <View style={styles.row}>
      <View style={styles.field}>
        <DetailField
          label={label}
          value={value}
          onPress={onPress}
          mentionSourceId={mentionSourceId}
        />
      </View>
      <TouchableOpacity style={styles.button} onPress={() => setModalVisible(true)}>
        <Ionicons
          name={hasComments ? 'chatbubble' : 'chatbubble-outline'}
          size={18}
          color={hasComments ? colors.primary : colors.textSecondary}
        />
        {hasComments && <Text style={styles.count}>{comments.length}</Text>}
      </TouchableOpacity>
      <CommentThreadModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        storyId={storyId}
        fieldLabel={label}
        fieldValueSnapshot={value}
        comments={comments}
        canComment={canComment}
        isStoryOwner={isStoryOwner}
        currentUserId={currentUserId}
        onSubmit={onAddComment}
        onDelete={onDeleteComment}
        onUpdate={onUpdateComment}
      />
    </View>
  );
};

export default CommentableDetailField;
