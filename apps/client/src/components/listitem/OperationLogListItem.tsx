import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import { OperationLogEntityType } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { OperationLogSelect } from '../../db/schema';
import { useEntityName } from '../../hooks/useEntityName';
import { useTheme } from '../../theme';

interface OperationLogListItemProps {
  log: OperationLogSelect;
}

const getOperationIcon = (operationType: string, color: string, size: number): React.ReactNode => {
  let iconName: keyof typeof Ionicons.glyphMap;
  switch (operationType) {
    case 'create':
      iconName = 'add-circle-outline';
      break;
    case 'update':
      iconName = 'create-outline';
      break;
    case 'delete':
      iconName = 'trash-outline';
      break;
    case 'reorder':
      iconName = 'repeat-outline';
      break;
    default:
      iconName = 'help-circle-outline';
  }
  return <Ionicons name={iconName} size={size} color={color} />;
};

const OperationLogListItem: React.FC<OperationLogListItemProps> = ({ log }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const { entityName: mainEntityName, loading: mainEntityLoading } = useEntityName(
    log.entityType as OperationLogEntityType,
    log.entityId
  );

  const { entityName: userName, loading: userLoading } = useEntityName(
    OperationLogEntityType.User,
    log.userId || ''
  );

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
    operationTypeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5,
    },
    operationTypeText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.primary,
      textTransform: 'capitalize',
      marginLeft: 5, // Space between icon and text
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
      <View style={styles.operationTypeContainer}>
        {getOperationIcon(log.operationType, colors.primary, 18)}
        <Text style={styles.operationTypeText}>
          {mainEntityLoading ? 'Loading...' : mainEntityName || t('unknown_entity')}
        </Text>
      </View>
      {log.userId && (
        <Text style={styles.entityInfo}>
          {t('user_id')}: {userLoading ? 'Loading...' : userName || log.userId}
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