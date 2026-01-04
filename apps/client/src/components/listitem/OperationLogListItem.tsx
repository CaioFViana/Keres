import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import { OperationLogEntityType } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { OperationLogSelect } from '../../db/schema';
import { useEntityName } from '../../hooks/useEntityName';
import { useUserDisplayName } from '../../hooks/useUserDisplayName'; // Import the new hook
import { useTheme } from '../../theme';

interface OperationLogListItemProps {
  log: OperationLogSelect;
  onPress?: (logId: string) => void; // Add this prop
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

const OperationLogListItem: React.FC<OperationLogListItemProps> = ({ log, onPress }) => { // Destructure onPress
  const { colors } = useTheme();
  const { t } = useTranslation();

  const { entityName: mainEntityName, loading: mainEntityLoading } = useEntityName(
    log.entityType as OperationLogEntityType,
    log.entityId,
    log.storyId
  );

  const userDisplayName = useUserDisplayName(log.userId, log.storyId); // Use the new hook

  // Determine the display text for the operation
  let operationDisplayText = '';
  if (mainEntityLoading) {
    operationDisplayText = 'Loading...';
  } else if (log.entityType === OperationLogEntityType.TagRelation) {
    // For TagRelation, mainEntityName is now the descriptive string like "TagName related to EntityName (EntityType)"
    if (log.operationType === 'create') {
      operationDisplayText = t('operation_tag_relation_added', { tagRelationDescription: mainEntityName });
    } else if (log.operationType === 'delete') {
      operationDisplayText = t('operation_tag_relation_removed', { tagRelationDescription: mainEntityName });
    } else {
      // Fallback for unexpected operation types on TagRelation
      operationDisplayText = t('tag_relation') + `: ${t(log.operationType)} ${mainEntityName || t('unknown_entity')}`;
    }
  } else if (log.entityType === OperationLogEntityType.NoteRelation) {
    if (log.operationType === 'create') {
      operationDisplayText = t('operation_note_relation_added', { noteRelationDescription: mainEntityName });
    } else if (log.operationType === 'delete') {
      operationDisplayText = t('operation_note_relation_removed', { noteRelationDescription: mainEntityName });
    } else {
      // Fallback for unexpected operation types on NoteRelation
      operationDisplayText = t('note_relation') + `: ${t(log.operationType)} ${mainEntityName || t('unknown_entity')}`;
    }
  } else {
    // For other entity types, just combine operation and entity name
    operationDisplayText = `${t(log.operationType)} ${mainEntityName || t('unknown_entity')}`;
  }

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
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress ? () => onPress(log.id) : undefined}
      disabled={!onPress} // Disable touch feedback if no onPress handler is provided
    >
      <View style={styles.operationTypeContainer}>
        {getOperationIcon(log.operationType, colors.primary, 18)}
        <Text style={styles.operationTypeText}>
          {operationDisplayText}
        </Text>
      </View>
      {log.userId && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
          <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} style={{ marginRight: 5 }} />
          <Text style={styles.entityInfo}>
            {userDisplayName}
          </Text>
        </View>
      )}
      <Text style={styles.timestamp}>{formattedDate}</Text>
      <Text style={styles.syncStatus}>
        {t('sync_status')}: {log.isSynced ? t('synced') : t('pending')} (v{log.serverOperationVersion})
      </Text>
    </TouchableOpacity>
  );
};

export default OperationLogListItem;