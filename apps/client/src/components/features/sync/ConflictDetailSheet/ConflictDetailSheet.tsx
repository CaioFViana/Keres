import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ConflictSummary } from '../../../../services/ConflictSummaryService';
import type { PendingConflict } from '../../../../services/SyncConflictService';
import { type ThemeColors, useTheme } from '../../../../theme';
import { useThemedStyles } from '../../../../theme/useThemedStyles';
import { typography } from '../../../../theme/tokens';
import ConflictSheetFrame from '../ConflictSheetFrame/ConflictSheetFrame';

interface ConflictDetailSheetProps {
  conflict: PendingConflict;
  summary: ConflictSummary;
  visible: boolean;
  isResolving: boolean;
  onClose: () => void;
  onKeepMine: () => void;
  onKeepServer: () => void;
  onCloneBoard?: () => void;
  onCloneSketch?: () => void;
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
  const styles = useThemedStyles(createActionStyles);

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
  onCloneSketch,
  onCompareFields,
}) => {
  const { t } = useTranslation();
  const reason = t(`conflict_reason_${conflict.reason}`, {
    defaultValue: t('conflict_reason_unknown'),
    entity: summary.entityLabel,
  });
  const styles = useThemedStyles(createStyles);

  return (
    <ConflictSheetFrame
      visible={visible}
      title={t('conflict_details_title')}
      subtitle={`${summary.entityLabel} — ${summary.title}`}
      onClose={onClose}
    >
      <Text style={styles.sectionTitle}>{t('conflict_what_happened')}</Text>
      <Text style={styles.reason}>{reason}</Text>

      <Text style={styles.sectionTitle}>{t('conflict_choose_action')}</Text>
      {summary.canKeepMine && (
        <ConflictAction
          icon="checkmark-circle-outline"
          title={t('conflict_keep_mine')}
          description={t('conflict_keep_mine_description')}
          onPress={onKeepMine}
          disabled={isResolving}
        />
      )}
      <ConflictAction
        icon="cloud-download-outline"
        title={t('conflict_keep_server')}
        description={t('conflict_keep_server_description')}
        onPress={onKeepServer}
        disabled={isResolving}
      />
      {summary.offerSketchClone && onCloneSketch && (
        <ConflictAction
          icon="copy-outline"
          title={t('conflict_clone_sketch')}
          description={t('conflict_clone_sketch_description')}
          onPress={onCloneSketch}
          disabled={isResolving}
        />
      )}
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
    </ConflictSheetFrame>
  );
};

const createActionStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    action: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      marginTop: 10,
    },
    icon: { marginTop: 1, marginRight: 12 },
    text: { flex: 1 },
    actionTitle: { fontSize: 15, fontWeight: 'bold', color: colors.text },
    actionDescription: { fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginTop: 3 },
  });

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sectionTitle: { fontSize: 13, fontWeight: 'bold', color: colors.text, marginTop: 20 },
    reason: { ...typography.body, color: colors.textSecondary, marginTop: 6 },
  });

export default ConflictDetailSheet;
