import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ConflictSummary } from '../../../../services/ConflictSummaryService';
import type { PendingConflict } from '../../../../services/SyncConflictService';
import { useTheme } from '../../../../theme';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';

interface ConflictDetailSheetProps {
  conflict: PendingConflict;
  summary: ConflictSummary;
  visible: boolean;
  isResolving: boolean;
  onClose: () => void;
  onKeepMine: () => void;
  onKeepServer: () => void;
  onCloneBoard?: () => void;
  onCompareFields?: () => void;
}

interface ActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  disabled: boolean;
}

const ConflictAction: React.FC<ActionProps> = ({ icon, title, description, onPress, disabled }) => {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    action: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      marginTop: 10,
    },
    icon: { marginTop: 1, marginRight: 11 },
    text: { flex: 1 },
    actionTitle: { fontSize: 15, fontWeight: 'bold', color: colors.text },
    actionDescription: { fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 3 },
  });

  return (
    <TouchableOpacity
      style={styles.action}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      accessibilityHint={description}
    >
      <Ionicons name={icon} size={23} color={colors.primary} style={styles.icon} />
      <View style={styles.text}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
};

const ConflictDetailSheet: React.FC<ConflictDetailSheetProps> = ({
  conflict,
  summary,
  visible,
  isResolving,
  onClose,
  onKeepMine,
  onKeepServer,
  onCloneBoard,
  onCompareFields,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reason = t(`conflict_reason_${conflict.reason}`, {
    defaultValue: t('conflict_reason_unknown'),
    entity: summary.entityLabel,
  });
  const styles = StyleSheet.create({
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 24,
      maxHeight: '85%',
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 14,
    },
    header: { flexDirection: 'row', alignItems: 'center' },
    headerText: { flex: 1, marginRight: 12 },
    title: { fontSize: 18, fontWeight: 'bold', color: colors.text },
    subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    closeButton: { padding: 4 },
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginTop: 20 },
    reason: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginTop: 6 },
  });

  return (
    <ResponsiveModal
      visible={visible}
      onClose={onClose}
      placement="adaptive"
      contentStyle={styles.sheet}
      maxHeight="85%"
    >
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('conflict_details_title')}</Text>
          <Text style={styles.subtitle}>{`${summary.entityLabel} — ${summary.title}`}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={t('conflict_close_details')}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView>
        <Text style={styles.sectionTitle}>{t('conflict_what_happened')}</Text>
        <Text style={styles.reason}>{reason}</Text>

        <Text style={styles.sectionTitle}>{t('conflict_choose_action')}</Text>
        <ConflictAction
          icon="checkmark-circle-outline"
          title={t('conflict_keep_mine')}
          description={t('conflict_keep_mine_description')}
          onPress={onKeepMine}
          disabled={isResolving}
        />
        <ConflictAction
          icon="cloud-download-outline"
          title={t('conflict_keep_server')}
          description={t('conflict_keep_server_description')}
          onPress={onKeepServer}
          disabled={isResolving}
        />
        {summary.offerBoardClone && onCloneBoard && (
          <ConflictAction
            icon="copy-outline"
            title={t('conflict_clone_board')}
            description={t('conflict_clone_board_description')}
            onPress={onCloneBoard}
            disabled={isResolving}
          />
        )}
        {!summary.canQuickResolve && onCompareFields && (
          <ConflictAction
            icon="git-compare-outline"
            title={t('conflict_compare_fields')}
            description={t('conflict_compare_fields_description')}
            onPress={onCompareFields}
            disabled={isResolving}
          />
        )}
      </ScrollView>
    </ResponsiveModal>
  );
};

export default ConflictDetailSheet;
