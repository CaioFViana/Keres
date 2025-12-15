import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OperationLogSelect } from '../../db/schema';
import { useTheme } from '../../theme';
import { useTranslation } from 'react-i18next';

interface OperationLogListItemProps {
  log: OperationLogSelect;
}

const OperationLogListItem: React.FC<OperationLogListItemProps> = ({ log }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const styles = StyleSheet.create({
    cardContainer: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      padding: 15,
      marginBottom: 10,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    operationType: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
      textTransform: 'capitalize',
    },
    entityInfo: {
      fontSize: 14,
      color: colors.text,
      marginTop: 5,
    },
    timestamp: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 5,
      textAlign: 'right',
    },
    syncStatus: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'right',
    },
  });

  const formattedDate = log.createdAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <View style={styles.cardContainer}>
      <Text style={styles.operationType}>
        {t(`operation_type_${log.operationType}`)} - {log.entityType}
      </Text>
      <Text style={styles.entityInfo}>
        {t('entity_id')}: {log.entityId}
      </Text>
      {log.userId && (
        <Text style={styles.entityInfo}>
          {t('user_id')}: {log.userId}
        </Text>
      )}
      <Text style={styles.timestamp}>{formattedDate}</Text>
      <Text style={styles.syncStatus}>
        {t('sync_status')}: {log.isSynced ? t('synced') : t('pending')} (v{log.serverOperationVersion})
      </Text>
    </View>
  );
};

export default OperationLogListItem;