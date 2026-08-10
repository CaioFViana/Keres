import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import CommentListItem from '@/src/components/features/list-items/CommentListItem';
import { useDrizzle } from '../../../../db';
import { CommentSelect } from '../../../../db/schema';
import { createCommentService } from '../../../../services/storymanagement/CommentService';
import { useTheme } from '../../../../theme';
import { entityEventEmitter } from '../../../../utils/EventEmitter';

interface CommentListProps {
  storyId: string;
  pageSize?: number;
  onPressItem?: (comment: CommentSelect) => void;
}

/**
 * Lista paginada, cross-entidade, de todos os comentários da história - modelada em
 * `OperationLogList` mas sem a lógica de "lacunas privadas" (não se aplica a comentários).
 */
const CommentList: React.FC<CommentListProps> = ({ storyId, pageSize = 20, onPressItem }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const drizzleDb = useDrizzle();
  const commentService = useMemo(() => createCommentService(drizzleDb), [drizzleDb]);

  const [comments, setComments] = useState<CommentSelect[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchComments = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const result = await commentService.getAllCommentsForStory(storyId, { page: targetPage, pageSize });
      setComments((current) => (targetPage === 0 ? result.items : [...current, ...result.items]));
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoading(false);
    }
  }, [commentService, storyId, pageSize]);

  useEffect(() => {
    setPage(0);
    fetchComments(0);
    const handleChange = (changedStoryId: string) => {
      if (changedStoryId === storyId) {
        setPage(0);
        fetchComments(0);
      }
    };
    entityEventEmitter.on('comment_changed', handleChange);
    return () => {
      entityEventEmitter.off('comment_changed', handleChange);
    };
  }, [storyId, fetchComments]);

  const handleLoadMore = useCallback(() => {
    if (!loading && comments.length < total) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchComments(nextPage);
    }
  }, [loading, comments.length, total, page, fetchComments]);

  const filteredComments = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return comments;
    return comments.filter((comment) => comment.commentText.toLowerCase().includes(query));
  }, [comments, search]);

  const styles = StyleSheet.create({
    container: { flex: 1, padding: 10 },
    // TextInput's own default style caps width at 80% - overridden here so the search box
    // fills the available width instead of leaving a fixed gap on wide screens.
    searchInput: { marginBottom: 10, width: '100%' },
    emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: 20 },
    footer: { paddingVertical: 20, alignItems: 'center' },
  });

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder={t('search')}
      />
      {loading && comments.length === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : filteredComments.length === 0 ? (
        <Text style={styles.emptyText}>{t('no_comments_yet')}</Text>
      ) : (
        <FlatList
          data={filteredComments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CommentListItem comment={item} onPress={onPressItem} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => (loading ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null)}
        />
      )}
    </View>
  );
};

export default CommentList;
