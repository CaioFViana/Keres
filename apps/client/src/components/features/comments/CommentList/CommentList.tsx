import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import CommentListItem from '@/src/components/features/list-items/CommentListItem';
import type { CommentSelect } from '../../../../db/schema';
import { useStoryComments } from '../../../../hooks/useStoryComments';
import { useTheme } from '../../../../theme';

interface CommentListProps {
  storyId: string;
  pageSize?: number;
  onPressItem?: (comment: CommentSelect) => void;
}

/**
 * A paginated, cross-entity list of every comment in the story - modelled on `OperationLogList` but
 * without the "private gaps" logic (which does not apply to comments).
 */
const CommentList: React.FC<CommentListProps> = ({ storyId, pageSize = 20, onPressItem }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { comments, loading, loadMore } = useStoryComments(storyId, pageSize);
  const [search, setSearch] = useState('');

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
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() =>
            loading ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

export default CommentList;
