import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { OperationLogSelect } from '../../../../db/schema';
import { useOperationLogs } from '../../../../hooks/useOperationLogs';
import { useTheme } from '../../../../theme';
import OperationLogListItem from '@/src/components/features/list-items/OperationLogListItem';

interface OperationLogListProps {
  storyId: string;
  limit?: number; // For dashboard view, e.g., last 20
  paginated?: boolean; // For full screen view
  pageSize?: number; // For paginated view
  onPressItem?: (logId: string) => void; // Add this prop
  shouldRefetch?: boolean; // Add this prop
  showPrivateGaps?: boolean;
}

type OperationLogListEntry =
  | { type: 'log'; log: OperationLogSelect }
  | { type: 'privateGap'; key: string };

const OperationLogList: React.FC<OperationLogListProps> = ({
  storyId,
  limit,
  paginated,
  pageSize = 20,
  onPressItem,
  shouldRefetch,
  showPrivateGaps = false,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { logs, loading, error, favoriteBehavior, worldPieceSections, loadMore } = useOperationLogs(
    {
      storyId,
      limit,
      paginated,
      pageSize,
      shouldRefetch,
    },
  );

  const listEntries = useMemo<OperationLogListEntry[]>(() => {
    const entries: OperationLogListEntry[] = [];
    let previousServerVersion: number | undefined;

    for (const log of logs) {
      const currentServerVersion =
        log.isSynced && (log.serverOperationVersion ?? 0) > 0
          ? log.serverOperationVersion!
          : undefined;

      if (
        showPrivateGaps &&
        favoriteBehavior === 'individual' &&
        previousServerVersion !== undefined &&
        currentServerVersion !== undefined &&
        currentServerVersion < previousServerVersion - 1
      ) {
        entries.push({
          type: 'privateGap',
          key: `private-gap-${previousServerVersion}-${currentServerVersion}`,
        });
      }

      entries.push({ type: 'log', log });
      if (currentServerVersion !== undefined) previousServerVersion = currentServerVersion;
    }

    return entries;
  }, [favoriteBehavior, logs, showPrivateGaps]);

  const hasPrivateGaps = listEntries.some((entry) => entry.type === 'privateGap');

  const handleLoadMore = loadMore;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 10,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    errorText: {
      color: colors.error,
      textAlign: 'center',
      marginTop: 20,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    emptyListText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 20,
    },
    footer: {
      paddingVertical: 20,
      borderTopWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    privacyNotice: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      marginBottom: 10,
    },
    privacyNoticeText: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      marginLeft: 8,
    },
    privateGap: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      marginBottom: 10,
    },
    privateGapLine: {
      backgroundColor: colors.border,
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },
    privateGapText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginHorizontal: 8,
      textAlign: 'center',
    },
  });

  const renderPrivacyNotice = () =>
    hasPrivateGaps ? (
      <View style={styles.privacyNotice} accessibilityRole="text">
        <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
        <Text style={styles.privacyNoticeText}>{t('private_operations_explanation')}</Text>
      </View>
    ) : null;

  const renderEntry = (entry: OperationLogListEntry) => {
    if (entry.type === 'log') {
      return (
        <OperationLogListItem
          log={entry.log}
          onPress={onPressItem}
          worldPieceSection={worldPieceSections[entry.log.entityId]}
        />
      );
    }

    return (
      <View
        style={styles.privateGap}
        accessible
        accessibilityRole="text"
        accessibilityLabel={t('private_operations_omitted')}
      >
        <View style={styles.privateGapLine} />
        <Ionicons name="lock-closed-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.privateGapText}>{t('private_operations_omitted')}</Text>
        <View style={styles.privateGapLine} />
      </View>
    );
  };

  if (loading && logs.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>
          {t('loading_operations')}...
        </Text>
      </View>
    );
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  if (logs.length === 0) {
    return <Text style={styles.emptyListText}>{t('no_operations_found')}</Text>;
  }

  if (!paginated) {
    return (
      <View style={styles.container}>
        {renderPrivacyNotice()}
        {listEntries.map((entry) => (
          <React.Fragment key={entry.type === 'log' ? entry.log.id : entry.key}>
            {renderEntry(entry)}
          </React.Fragment>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={listEntries}
        keyExtractor={(item) => (item.type === 'log' ? item.log.id : item.key)}
        renderItem={({ item }) => renderEntry(item)}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={renderPrivacyNotice}
        ListFooterComponent={() =>
          paginated && loading ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
      />
    </View>
  );
};

export default OperationLogList;
