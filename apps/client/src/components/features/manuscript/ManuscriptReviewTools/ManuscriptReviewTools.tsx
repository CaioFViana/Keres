import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Button from '../../../common/controls/Button/Button';
import CommentThreadModal from '../../comments/CommentThreadModal/CommentThreadModal';
import { manuscriptTextMetrics } from '../manuscriptTextMetrics';
import type { CommentSelect } from '../../../../db/schema';
import { useTheme } from '../../../../theme';
import { readClippedSelection } from '../../../../hooks/useWebSelectionClip';

export interface ManuscriptReviewBar {
  sceneLabel: string;
  count: number;
}

export interface ManuscriptReviewThread {
  key: string;
  sceneId: string;
  label: string;
  snapshot: string;
  comments: CommentSelect[];
}

interface ManuscriptReviewToolsProps {
  /** Null hides the bar (no scenes, or read mode owns the screen). */
  bar: ManuscriptReviewBar | null;
  onBarPress: () => void;
  /** Null keeps the thread closed; mounting per thread keeps drafts per scene. */
  thread: ManuscriptReviewThread | null;
  onCloseThread: () => void;
  storyId: string;
  canComment: boolean;
  isStoryOwner: boolean;
  currentUserId: string | null;
  onSubmitThread: (input: {
    commentText: string;
    excerptText: string | null;
    criticality: number;
  }) => Promise<void>;
  onDeleteThread: (commentId: string) => Promise<void>;
  onUpdateThread: (
    commentId: string,
    changes: { commentText?: string; criticality?: number },
  ) => Promise<void>;
  testID?: string;
}

/**
 * Review mode's chrome: the fixed bottom bar addressing one scene, plus that
 * scene's body thread. The bar rides below the list like the editor's footer,
 * never inside the scroller.
 */
export function ManuscriptReviewTools({
  bar,
  onBarPress,
  thread,
  onCloseThread,
  storyId,
  canComment,
  isStoryOwner,
  currentUserId,
  onSubmitThread,
  onDeleteThread,
  onUpdateThread,
  testID,
}: ManuscriptReviewToolsProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingHorizontal: manuscriptTextMetrics.containerPaddingHorizontal,
          paddingVertical: 8,
        },
        row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
        label: { flex: 1, color: colors.textSecondary, fontSize: 13 },
      }),
    [colors],
  );

  return (
    <>
      {bar && (
        <View style={styles.bar} testID={testID}>
          <View style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {bar.sceneLabel}
            </Text>
            <Button onPress={onBarPress}>
              {t('manuscript_comments_button', { count: bar.count })}
            </Button>
          </View>
        </View>
      )}
      {thread && (
        <CommentThreadModal
          visible
          onClose={onCloseThread}
          storyId={storyId}
          fieldLabel={thread.label}
          showExcerptAnchorNotice
          initialExcerpt={readClippedSelection(thread.key)}
          fieldValueSnapshot={thread.snapshot}
          comments={thread.comments}
          canComment={canComment}
          isStoryOwner={isStoryOwner}
          currentUserId={currentUserId}
          onSubmit={onSubmitThread}
          onDelete={onDeleteThread}
          onUpdate={onUpdateThread}
        />
      )}
    </>
  );
}
