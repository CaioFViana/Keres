import Button from '@/src/components/common/controls/Button/Button';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import MarkedText from '@/src/components/common/display/MarkedText/MarkedText';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { TextRange } from '@keres/shared';
import {
  collapseWhitespace,
  findFirstExcerptMatch,
  frameMatchWindow,
  stripMarkdownText,
} from '@keres/shared';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CommentSelect } from '../../../../db/schema';
import { useAuthorProfiles } from '../../../../hooks/useAuthorProfiles';
import { useTheme } from '../../../../theme';
import { AppAlert } from '../../../../utils/AppAlert';
import type { CommentCriticality } from '../../../../utils/commentCriticality';
import {
  CRITICALITY_ICONS,
  CRITICALITY_LEVELS,
  DEFAULT_CRITICALITY,
} from '../../../../utils/commentCriticality';

interface CommentThreadModalProps {
  visible: boolean;
  onClose: () => void;
  storyId: string;
  fieldLabel: string;
  fieldValueSnapshot: string;
  comments: CommentSelect[];
  canComment: boolean;
  isStoryOwner: boolean;
  currentUserId: string | null;
  onSubmit: (input: {
    commentText: string;
    excerptText: string | null;
    criticality: number;
  }) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onUpdate: (
    commentId: string,
    changes: { commentText?: string; criticality?: number },
  ) => Promise<void>;
  /** Manuscript prose composer: explain that the first match anchors the comment. */
  showExcerptAnchorNotice?: boolean;
  /** A fresh text selection, pre-filled into the excerpt composer on open. */
  initialExcerpt?: string | null;
}

/**
 * Uses the same `ResponsiveModal` as `GraphNodeSheet`/selectors: bottom sheet on compact
 * screens, side panel on wide screens - instead of a fixed bottom sheet at any screen
 * size, which looked like a mobile app even on desktop.
 */
const CommentThreadModal: React.FC<CommentThreadModalProps> = ({
  visible,
  onClose,
  storyId,
  fieldLabel,
  fieldValueSnapshot,
  comments,
  canComment,
  isStoryOwner,
  currentUserId,
  onSubmit,
  onDelete,
  onUpdate,
  showExcerptAnchorNotice = false,
  initialExcerpt = null,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const authorIds = useMemo(() => comments.map((comment) => comment.authorUserId), [comments]);
  const profiles = useAuthorProfiles(storyId, authorIds, visible);

  const [commentText, setCommentText] = useState('');
  const [excerptText, setExcerptText] = useState('');
  const [criticality, setCriticality] = useState<CommentCriticality>(DEFAULT_CRITICALITY);
  // Derived-state reset during render (the sanctioned pattern, not an effect): a fresh
  // selection pre-fills the excerpt on open; without one the composer keeps whatever
  // it had, so drafts survive close/reopen exactly as before.
  const [prevVisible, setPrevVisible] = useState(false);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible && initialExcerpt && initialExcerpt.trim()) setExcerptText(initialExcerpt);
  }
  const [submitting, setSubmitting] = useState(false);
  // Web textareas never auto-grow: pin each composer's measured content height
  // as its minimum (same technique as the prose editor) so long comments grow
  // the field instead of scrolling inside a fixed box.
  const [excerptHeight, setExcerptHeight] = useState<number | null>(null);
  const [commentHeight, setCommentHeight] = useState<number | null>(null);

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [comments],
  );

  // Prose snapshots hold markdown but preview rendered, like the document: no
  // markup symbol ever shows. Plain detail fields preview raw, where asterisks
  // are literal prose. Either way the preview flows as one line: line breaks
  // would corrupt the framed window, so they read as spaces.
  const displaySnapshot = useMemo(() => {
    const rendered = showExcerptAnchorNotice
      ? stripMarkdownText(fieldValueSnapshot)
      : fieldValueSnapshot;
    return collapseWhitespace(rendered);
  }, [fieldValueSnapshot, showExcerptAnchorNotice]);
  // The typed excerpt anchors live in the preview by the same rule that marks it:
  // first occurrence, case- and accent-insensitive, compared in the exact space
  // the preview shows (rendered, then collapsed, on both sides). A stale excerpt
  // (field edited since) simply marks nothing and keeps its warning.
  const liveExcerptMatch = useMemo(() => {
    const rendered = showExcerptAnchorNotice ? stripMarkdownText(excerptText) : excerptText;
    return findFirstExcerptMatch(displaySnapshot, collapseWhitespace(rendered));
  }, [displaySnapshot, excerptText, showExcerptAnchorNotice]);
  // Long previews frame around the anchor (like backlinks: ...context marked
  // context...) instead of always opening at the head. Short texts pass through
  // untouched, and with no anchor the head shows as before.
  const framedPreview = useMemo((): { text: string; ranges: TextRange[] } => {
    if (!liveExcerptMatch) return { text: displaySnapshot, ranges: [] };
    const framed = frameMatchWindow(displaySnapshot, liveExcerptMatch);
    return { text: framed.text, ranges: [framed.match] };
  }, [displaySnapshot, liveExcerptMatch]);
  const excerptMismatch = excerptText.trim().length > 0 && !liveExcerptMatch;

  const handleSubmit = useCallback(async () => {
    const trimmedComment = commentText.trim();
    if (!trimmedComment) return;
    setSubmitting(true);
    try {
      await onSubmit({
        commentText: trimmedComment,
        excerptText: excerptText.trim() || null,
        criticality,
      });
      setCommentText('');
      setExcerptText('');
      setCriticality(DEFAULT_CRITICALITY);
    } catch (error) {
      console.error('Failed to post comment:', error);
      AppAlert.alert(t('error'), t('failed_to_post_comment'));
    } finally {
      setSubmitting(false);
    }
  }, [commentText, excerptText, criticality, onSubmit, t]);

  const handleDelete = useCallback(
    (commentId: string) => {
      AppAlert.alert(t('delete_comment_confirm'), undefined, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await onDelete(commentId);
            } catch (error) {
              console.error('Failed to delete comment:', error);
              AppAlert.alert(t('error'), t('failed_to_delete_comment'));
            }
          },
        },
      ]);
    },
    [onDelete, t],
  );

  const styles = StyleSheet.create({
    sheet: { flex: 1, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
    keyboardContent: { flexGrow: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 15,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text, flexShrink: 1 },
    list: { paddingHorizontal: 15, flexGrow: 1 },
    commentRow: { flexDirection: 'row', marginVertical: 10 },
    commentBody: { flex: 1, marginLeft: 10 },
    commentHeaderRow: { flexDirection: 'row', alignItems: 'center' },
    authorName: { color: colors.text, fontWeight: '600', fontSize: 14 },
    timestamp: { color: colors.textSecondary, fontSize: 11, marginLeft: 8 },
    excerptBlock: {
      borderLeftWidth: 2,
      borderLeftColor: colors.primary,
      backgroundColor: colors.primaryContainer,
      paddingLeft: 8,
      marginTop: 4,
      marginBottom: 2,
    },
    excerptText: { color: colors.textSecondary, fontStyle: 'italic', fontSize: 13 },
    commentText: { color: colors.text, fontSize: 14, marginTop: 2 },
    deleteButton: { marginTop: 4 },
    deleteText: { color: colors.error, fontSize: 12 },
    emptyText: {
      color: colors.textSecondary,
      fontStyle: 'italic',
      paddingVertical: 12,
      paddingHorizontal: 15,
    },
    footer: {
      padding: 15,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    snapshotBlock: {
      backgroundColor: colors.surface,
      borderRadius: 6,
      padding: 8,
      marginBottom: 8,
    },
    snapshotLabel: { color: colors.textSecondary, fontSize: 11, marginBottom: 2 },
    snapshotText: { color: colors.text, fontSize: 13 },
    input: { width: '100%', marginBottom: 8 },
    excerptInput: { minHeight: 40, textAlignVertical: 'top' },
    commentInput: { minHeight: 70, textAlignVertical: 'top' },
    warningText: { color: colors.notification, fontSize: 12, marginBottom: 8 },
    noticeText: { color: colors.textSecondary, fontSize: 12, marginBottom: 8 },
    // Criticality icons and the post button share the same row, instead of each one
    // taking the full width on separate rows - that left a fair amount of horizontal
    // space idle on wide screens.
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    criticalityRow: { flexDirection: 'row' },
    criticalityButton: { padding: 8, borderRadius: 8, marginRight: 6 },
    criticalityButtonActive: { backgroundColor: colors.primaryContainer },
    postButton: { paddingHorizontal: 20 },
  });

  // Pinned composer: rides the footer's slot below the thread scroll view, so
  // scrolling the thread never pushes the inputs and the post button away.
  const footer = !canComment ? undefined : (
    <View style={styles.footer} testID="comment-composer">
      <View style={styles.snapshotBlock}>
        <Text style={styles.snapshotLabel}>{fieldLabel}</Text>
        <MarkedText
          text={framedPreview.text || t('common_na')}
          ranges={framedPreview.ranges}
          style={styles.snapshotText}
          numberOfLines={4}
        />
      </View>

      <TextInput
        testID="comment-excerpt-input"
        style={[
          styles.input,
          styles.excerptInput,
          excerptHeight != null && { minHeight: Math.max(40, excerptHeight) },
        ]}
        value={excerptText}
        onChangeText={setExcerptText}
        onContentSizeChange={(event) => setExcerptHeight(event.nativeEvent.contentSize.height)}
        placeholder={t('excerpt_placeholder')}
        multiline
      />
      {showExcerptAnchorNotice && (
        <Text style={styles.noticeText}>{t('excerpt_anchor_notice')}</Text>
      )}
      {excerptMismatch && <Text style={styles.warningText}>{t('excerpt_not_found_warning')}</Text>}

      <TextInput
        testID="comment-text-input"
        style={[
          styles.input,
          styles.commentInput,
          commentHeight != null && { minHeight: Math.max(70, commentHeight) },
        ]}
        value={commentText}
        onChangeText={setCommentText}
        onContentSizeChange={(event) => setCommentHeight(event.nativeEvent.contentSize.height)}
        placeholder={t('comment_text_placeholder')}
        multiline
      />

      <View style={styles.actionRow}>
        <View style={styles.criticalityRow}>
          {CRITICALITY_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.criticalityButton,
                criticality === level && styles.criticalityButtonActive,
              ]}
              onPress={() => setCriticality(level)}
              accessibilityLabel={t(`comment_criticality_${level}`)}
            >
              <Ionicons
                name={CRITICALITY_ICONS[level]}
                size={20}
                color={criticality === level ? colors.primary : colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>

        <Button
          onPress={handleSubmit}
          disabled={submitting || !commentText.trim()}
          style={styles.postButton}
        >
          {submitting ? t('saving') : t('add_comment')}
        </Button>
      </View>
    </View>
  );

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      placement="adaptive"
      contentStyle={styles.sheet}
      maxHeight="85%"
      keyboardAvoiding={false}
    >
      <KeyboardAwareScreen
        contentContainerStyle={styles.keyboardContent}
        keyboardVerticalOffset={0}
        footer={footer}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {fieldLabel}
          </Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.list}>
          {sortedComments.length === 0 ? (
            <Text style={styles.emptyText}>{t('no_comments_yet')}</Text>
          ) : (
            sortedComments.map((comment) => {
              const profile = profiles[comment.authorUserId];
              const canManage = isStoryOwner || comment.authorUserId === currentUserId;
              return (
                <View key={comment.id} style={styles.commentRow}>
                  <Avatar
                    seed={comment.authorUserId}
                    color={profile?.avatarColor}
                    icon={profile?.avatarIcon}
                    size={32}
                  />
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeaderRow}>
                      <Ionicons
                        name={
                          CRITICALITY_ICONS[comment.criticality as CommentCriticality] ??
                          CRITICALITY_ICONS[3]
                        }
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.authorName}>
                        {' '}
                        {profile?.name || comment.authorUserId}
                      </Text>
                      <Text style={styles.timestamp}>{comment.createdAt.toLocaleString()}</Text>
                    </View>
                    {!!comment.excerptText && (
                      <View style={styles.excerptBlock}>
                        <Text style={styles.excerptText}>{comment.excerptText}</Text>
                      </View>
                    )}
                    <Text style={styles.commentText}>{comment.commentText}</Text>
                    {canManage && (
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDelete(comment.id)}
                      >
                        <Text style={styles.deleteText}>{t('delete')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </KeyboardAwareScreen>
    </ResponsiveModal>
  );
};

export default CommentThreadModal;
