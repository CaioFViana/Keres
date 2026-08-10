import Button from '@/src/components/common/controls/Button/Button';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { Ionicons } from '@expo/vector-icons';
import { eq } from 'drizzle-orm';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../../../db';
import { CommentSelect, servers, stories } from '../../../../db/schema';
import { ResolvedUserProfile, useUserProfileResolver } from '../../../../hooks/useUserProfileResolver';
import { useTheme } from '../../../../theme';
import { AppAlert } from '../../../../utils/AppAlert';
import { CommentCriticality, CRITICALITY_ICONS, CRITICALITY_LEVELS, DEFAULT_CRITICALITY } from '../../../../utils/commentCriticality';

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
  onSubmit: (input: { commentText: string; excerptText: string | null; criticality: number }) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onUpdate: (commentId: string, changes: { commentText?: string; criticality?: number }) => Promise<void>;
}

/**
 * Usa o mesmo `ResponsiveModal` de `GraphNodeSheet`/seletores: bottom sheet em telas
 * compactas, painel lateral em telas largas - em vez de um bottom sheet fixo em qualquer
 * tamanho de tela, que ficava com cara de app mobile mesmo no desktop.
 */
const CommentThreadModal: React.FC<CommentThreadModalProps> = ({
  visible, onClose, storyId, fieldLabel, fieldValueSnapshot, comments,
  canComment, isStoryOwner, currentUserId, onSubmit, onDelete, onUpdate,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const resolveProfile = useUserProfileResolver();

  const [profiles, setProfiles] = useState<Record<string, ResolvedUserProfile>>({});
  const [commentText, setCommentText] = useState('');
  const [excerptText, setExcerptText] = useState('');
  const [criticality, setCriticality] = useState<CommentCriticality>(DEFAULT_CRITICALITY);
  const [submitting, setSubmitting] = useState(false);

  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    [comments]
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId), columns: { serverId: true } });
      const storyServer = story?.serverId
        ? await db.query.servers.findFirst({ where: eq(servers.id, story.serverId) })
        : undefined;
      const uniqueAuthorIds = Array.from(new Set(comments.map((comment) => comment.authorUserId)));
      const resolved = await Promise.all(uniqueAuthorIds.map((authorId) => resolveProfile(authorId, storyServer)));
      if (!cancelled) {
        setProfiles(Object.fromEntries(resolved.map((profile) => [profile.id, profile])));
      }
    })();
    return () => { cancelled = true; };
  }, [visible, comments, db, storyId, resolveProfile]);

  const excerptMismatch = excerptText.trim().length > 0 && !fieldValueSnapshot.includes(excerptText.trim());

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

  const handleDelete = useCallback((commentId: string) => {
    AppAlert.alert(
      t('delete_comment_confirm'),
      undefined,
      [
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
      ]
    );
  }, [onDelete, t]);

  const styles = StyleSheet.create({
    sheet: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    headerTitle: { fontSize: 17, fontWeight: 'bold', color: colors.text, flexShrink: 1 },
    list: { paddingHorizontal: 15 },
    commentRow: { flexDirection: 'row', marginVertical: 10 },
    commentBody: { flex: 1, marginLeft: 10 },
    commentHeaderRow: { flexDirection: 'row', alignItems: 'center' },
    authorName: { color: colors.text, fontWeight: '600', fontSize: 14 },
    timestamp: { color: colors.textSecondary, fontSize: 11, marginLeft: 8 },
    excerptBlock: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 8, marginTop: 4, marginBottom: 2 },
    excerptText: { color: colors.textSecondary, fontStyle: 'italic', fontSize: 13 },
    commentText: { color: colors.text, fontSize: 14, marginTop: 2 },
    deleteButton: { marginTop: 4 },
    deleteText: { color: colors.error, fontSize: 12 },
    emptyText: { color: colors.textSecondary, fontStyle: 'italic', paddingVertical: 12, paddingHorizontal: 15 },
    footer: { padding: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    snapshotBlock: { backgroundColor: colors.surface, borderRadius: 6, padding: 8, marginBottom: 8 },
    snapshotLabel: { color: colors.textSecondary, fontSize: 11, marginBottom: 2 },
    snapshotText: { color: colors.text, fontSize: 13 },
    input: { width: '100%', marginBottom: 8 },
    excerptInput: { minHeight: 40, textAlignVertical: 'top' },
    commentInput: { minHeight: 70, textAlignVertical: 'top' },
    warningText: { color: colors.notification, fontSize: 12, marginBottom: 8 },
    // Ícones de criticidade e o botão de postar dividem a mesma linha, em vez de cada um
    // ocupar a largura toda em linhas separadas - ficava com bastante espaço horizontal
    // ocioso em telas largas.
    actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    criticalityRow: { flexDirection: 'row' },
    criticalityButton: { padding: 8, borderRadius: 8, marginRight: 6 },
    criticalityButtonActive: { backgroundColor: colors.primaryContainer },
    postButton: { paddingHorizontal: 20 },
  });

  return (
    <ResponsiveModal visible={visible} onClose={onClose} placement="adaptive" contentStyle={styles.sheet} maxHeight="85%">
      <View style={styles.header}>
        <Text style={styles.headerTitle} numberOfLines={1}>{fieldLabel}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel={t('close')} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {sortedComments.length === 0 ? (
          <Text style={styles.emptyText}>{t('no_comments_yet')}</Text>
        ) : sortedComments.map((comment) => {
          const profile = profiles[comment.authorUserId];
          const canManage = isStoryOwner || comment.authorUserId === currentUserId;
          return (
            <View key={comment.id} style={styles.commentRow}>
              <Avatar seed={comment.authorUserId} color={profile?.avatarColor} icon={profile?.avatarIcon} size={32} />
              <View style={styles.commentBody}>
                <View style={styles.commentHeaderRow}>
                  <Ionicons
                    name={CRITICALITY_ICONS[comment.criticality as CommentCriticality] ?? CRITICALITY_ICONS[3]}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.authorName}> {profile?.name || comment.authorUserId}</Text>
                  <Text style={styles.timestamp}>{comment.createdAt.toLocaleString()}</Text>
                </View>
                {!!comment.excerptText && (
                  <View style={styles.excerptBlock}>
                    <Text style={styles.excerptText}>{comment.excerptText}</Text>
                  </View>
                )}
                <Text style={styles.commentText}>{comment.commentText}</Text>
                {canManage && (
                  <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(comment.id)}>
                    <Text style={styles.deleteText}>{t('delete')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {canComment && (
        <View style={styles.footer}>
          <View style={styles.snapshotBlock}>
            <Text style={styles.snapshotLabel}>{fieldLabel}</Text>
            <Text style={styles.snapshotText} numberOfLines={4}>{fieldValueSnapshot || t('common_na')}</Text>
          </View>

          <TextInput
            style={[styles.input, styles.excerptInput]}
            value={excerptText}
            onChangeText={setExcerptText}
            placeholder={t('excerpt_placeholder')}
            multiline
          />
          {excerptMismatch && <Text style={styles.warningText}>{t('excerpt_not_found_warning')}</Text>}

          <TextInput
            style={[styles.input, styles.commentInput]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('comment_text_placeholder')}
            multiline
          />

          <View style={styles.actionRow}>
            <View style={styles.criticalityRow}>
              {CRITICALITY_LEVELS.map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[styles.criticalityButton, criticality === level && styles.criticalityButtonActive]}
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

            <Button onPress={handleSubmit} disabled={submitting || !commentText.trim()} style={styles.postButton}>
              {submitting ? t('saving') : t('add_comment')}
            </Button>
          </View>
        </View>
      )}
    </ResponsiveModal>
  );
};

export default CommentThreadModal;
