import { Ionicons } from '@expo/vector-icons';
import React, { useId, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TextRange } from '@keres/shared';
import { findAllFoldedMatches } from '@keres/shared';
import DetailField from '@/src/components/common/display/DetailField/DetailField';
import { useWebSelectionClip } from '../../../../hooks/useWebSelectionClip';
import type { CommentSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
import CommentThreadModal from '../CommentThreadModal/CommentThreadModal';

export interface CommentableDetailFieldProps {
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
  // Instance-stable registry key: two fields never share a selection slot.
  const { containerRef, readSelection } = useWebSelectionClip(useId());
  // Icon and marked-span taps share one opener.
  const openThread = () => setModalVisible(true);
  const hasComments = comments.length > 0;
  // Every commented passage, search-style: all occurrences of every excerpt, so the
  // value reads like the manuscript's marked prose. Tapping one opens this thread.
  const commentRanges: TextRange[] = useMemo(() => {
    const ranges: TextRange[] = [];
    for (const comment of comments) {
      ranges.push(...findAllFoldedMatches(value, comment.excerptText));
    }
    return ranges;
  }, [comments, value]);

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
      <View ref={containerRef} collapsable={false} style={styles.field}>
        <DetailField
          label={label}
          value={value}
          onPress={onPress}
          mentionSourceId={mentionSourceId}
          commentRanges={commentRanges}
          onCommentPress={openThread}
          selectable
        />
      </View>
      <TouchableOpacity style={styles.button} onPress={openThread}>
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
        // Read at render, consumed on open: the live web selection clipped to this
        // field (native reads null - manual excerpt as before).
        initialExcerpt={readSelection()}
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
