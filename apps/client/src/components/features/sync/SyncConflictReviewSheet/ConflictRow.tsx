import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConflictSummary } from '../../../../services/ConflictSummaryService';
import { useTheme } from '../../../../theme';

interface ConflictRowProps {
  summary: ConflictSummary;
  isResolving: boolean;
  onKeepMine: () => void;
  onKeepServer: () => void;
  onOpenDiff: () => void;
}

/**
 * Uma linha por conflito. Quando dá pra resolver sem comparar campo a campo (toda relação, e
 * todo conflito de conteúdo binário - exclusão, sem cópia no servidor, sem campo realmente
 * disputado), dois botões de ícone resolvem na hora, sem navegar pra lugar nenhum - mesmo
 * idioma visual dos botões de ação inline de `FriendshipListScreen`. Só abre o drill-in de
 * diff quando há mesmo múltiplos campos de conteúdo pra comparar.
 */
const ConflictRow: React.FC<ConflictRowProps> = ({
  summary,
  isResolving,
  onKeepMine,
  onKeepServer,
  onOpenDiff,
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
    textWrapper: { flex: 1, marginRight: 8 },
    title: { fontSize: 13, fontWeight: '600', color: colors.text },
    detail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    actions: { flexDirection: 'row' },
    actionButton: { padding: 8 },
  });

  const icon = summary.kind === 'relation' ? 'git-network-outline' : 'document-text-outline';

  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} style={styles.icon} />
      <View style={styles.textWrapper}>
        <Text style={styles.title} numberOfLines={1}>
          {summary.title}
        </Text>
        <Text style={styles.detail} numberOfLines={2}>
          {summary.detail}
        </Text>
      </View>
      {summary.canQuickResolve ? (
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onKeepMine}
            disabled={isResolving}
            style={styles.actionButton}
            accessibilityLabel={t('conflict_keep_mine')}
          >
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onKeepServer}
            disabled={isResolving}
            style={styles.actionButton}
            accessibilityLabel={t('conflict_keep_server')}
          >
            <Ionicons name="cloud-download-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity onPress={onOpenDiff} disabled={isResolving} style={styles.actionButton}>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default ConflictRow;
