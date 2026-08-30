import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ConflictSummary } from '../../../../services/ConflictSummaryService';
import { useTheme } from '../../../../theme';

interface ConflictRowProps {
  summary: ConflictSummary;
  isResolving: boolean;
  onKeepMine: () => void;
  onKeepServer: () => void;
  onCloneBoard?: () => void;
  onOpenDetails: () => void;
}

/**
 * One row per conflict. The row opens an accessible explanation of the conflict. Fast actions
 * remain available for simple cases, but the parent asks for confirmation before applying them.
 */
const ConflictRow: React.FC<ConflictRowProps> = ({
  summary,
  isResolving,
  onKeepMine,
  onKeepServer,
  onCloneBoard,
  onOpenDetails,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      paddingVertical: 9,
      paddingHorizontal: 11,
      marginBottom: 7,
    },
    icon: { marginRight: 9 },
    textWrapper: { flex: 1, marginRight: 8, paddingVertical: 2 },
    title: { fontSize: 13, fontWeight: '600', color: colors.text },
    detail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    actions: { flexDirection: 'row' },
    actionButton: { padding: 8 },
  });

  const icon = summary.kind === 'relation' ? 'git-network-outline' : 'document-text-outline';

  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} style={styles.icon} />
      <TouchableOpacity
        style={styles.textWrapper}
        onPress={onOpenDetails}
        disabled={isResolving}
        accessibilityRole="button"
        accessibilityLabel={t('conflict_open_details', { title: summary.title })}
        accessibilityHint={t('conflict_open_details_hint')}
      >
        <Text style={styles.title} numberOfLines={1}>
          {summary.title}
        </Text>
        <Text style={styles.detail} numberOfLines={2}>
          {summary.detail}
        </Text>
      </TouchableOpacity>
      {summary.canQuickResolve ? (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onKeepMine}
            disabled={isResolving}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={t('conflict_keep_mine')}
            accessibilityHint={t('conflict_keep_mine_description')}
          >
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onKeepServer}
            disabled={isResolving}
            style={styles.actionButton}
            accessibilityRole="button"
            accessibilityLabel={t('conflict_keep_server')}
            accessibilityHint={t('conflict_keep_server_description')}
          >
            <Ionicons name="cloud-download-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          {summary.offerBoardClone && onCloneBoard && (
            <TouchableOpacity
              onPress={onCloneBoard}
              disabled={isResolving}
              style={styles.actionButton}
              accessibilityRole="button"
              accessibilityLabel={t('conflict_clone_board')}
              accessibilityHint={t('conflict_clone_board_description')}
            >
              <Ionicons name="copy-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity
          onPress={onOpenDetails}
          disabled={isResolving}
          style={styles.actionButton}
          accessibilityRole="button"
          accessibilityLabel={t('conflict_open_details', { title: summary.title })}
          accessibilityHint={t('conflict_open_details_hint')}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ConflictRow;
