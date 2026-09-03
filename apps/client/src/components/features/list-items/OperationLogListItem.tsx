import { Ionicons } from '@expo/vector-icons';
import { getEntityAppearance, OperationLogEntityType } from '@keres/shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { OperationLogSelect } from '../../../db/schema';
import { useEntityName } from '../../../hooks/useEntityName';
import { useUserDisplayName } from '../../../hooks/useUserDisplayName'; // Import the new hook
import { useTheme } from '../../../theme';

interface OperationLogListItemProps {
  log: OperationLogSelect;
  onPress?: (logId: string) => void; // Add this prop
}

const getOperationIconName = (operationType: string): keyof typeof Ionicons.glyphMap => {
  switch (operationType) {
    case 'create':
      return 'add-circle-outline';
    case 'update':
      return 'create-outline';
    case 'delete':
      return 'trash-outline';
    case 'reorder':
      return 'repeat-outline';
    default:
      return 'help-circle-outline';
  }
};

const RELATION_ENTITY_TYPES = new Set<string>([
  OperationLogEntityType.CharacterRelation,
  OperationLogEntityType.CharacterScene,
  OperationLogEntityType.GalleryRelation,
  OperationLogEntityType.LocationRelation,
  OperationLogEntityType.NoteRelation,
  OperationLogEntityType.PlotScene,
  OperationLogEntityType.SeeAlsoRelation,
  OperationLogEntityType.StatRelation,
  OperationLogEntityType.TagRelation,
]);

const OperationLogListItem: React.FC<OperationLogListItemProps> = ({ log, onPress }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const { entityName: mainEntityName, loading: mainEntityLoading } = useEntityName(
    log.entityType as OperationLogEntityType,
    log.entityId,
    log.storyId,
  );

  const userDisplayName = useUserDisplayName(log.userId, log.storyId); // Use the new hook
  const entityAppearance = getEntityAppearance(log.entityType);
  const isRelation = RELATION_ENTITY_TYPES.has(log.entityType);
  const entityIcon = isRelation
    ? 'link-outline'
    : (entityAppearance.icon as keyof typeof Ionicons.glyphMap);
  const entityIconColor = isRelation ? colors.secondary : entityAppearance.color;
  const operationIconColor = log.operationType === 'delete' ? colors.error : colors.primary;

  // Determine the display text for the operation
  let operationDisplayText = '';
  if (mainEntityLoading) {
    operationDisplayText = 'Loading...';
  } else if (log.entityType === OperationLogEntityType.TagRelation) {
    // For TagRelation, mainEntityName is now the descriptive string like "TagName related to EntityName (EntityType)"
    if (log.operationType === 'create') {
      operationDisplayText = t('operation_tag_relation_added', {
        tagRelationDescription: mainEntityName,
      });
    } else if (log.operationType === 'delete') {
      operationDisplayText = t('operation_tag_relation_removed', {
        tagRelationDescription: mainEntityName,
      });
    } else {
      // Fallback for unexpected operation types on TagRelation
      operationDisplayText =
        t('tag_relation') + `: ${t(log.operationType)} ${mainEntityName || t('unknown_entity')}`;
    }
  } else if (log.entityType === OperationLogEntityType.NoteRelation) {
    if (log.operationType === 'create') {
      operationDisplayText = t('operation_note_relation_added', {
        noteRelationDescription: mainEntityName,
      });
    } else if (log.operationType === 'delete') {
      operationDisplayText = t('operation_note_relation_removed', {
        noteRelationDescription: mainEntityName,
      });
    } else {
      // Fallback for unexpected operation types on NoteRelation
      operationDisplayText =
        t('note_relation') + `: ${t(log.operationType)} ${mainEntityName || t('unknown_entity')}`;
    }
  } else if (log.entityType === OperationLogEntityType.GalleryRelation) {
    if (log.operationType === 'create') {
      operationDisplayText = t('operation_gallery_relation_added', {
        galleryRelationDescription: mainEntityName,
      });
    } else if (log.operationType === 'delete') {
      operationDisplayText = t('operation_gallery_relation_removed', {
        galleryRelationDescription: mainEntityName,
      });
    } else {
      // Fallback for unexpected operation types on GalleryRelation
      operationDisplayText =
        t('gallery_relation') +
        `: ${t(log.operationType)} ${mainEntityName || t('unknown_entity')}`;
    }
  } else {
    // For other entity types, just combine operation and entity name
    operationDisplayText = `${t(log.operationType)} ${mainEntityName || t('unknown_entity')}`;
  }

  const styles = StyleSheet.create({
    cardContainer: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 15,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 5,
    },
    operationMarker: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 9,
    },
    entityIcon: { marginRight: 6 },
    operationTypeText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      textTransform: 'capitalize',
      flexShrink: 1,
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

  const formattedDate = log.createdAt.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={onPress ? () => onPress(log.id) : undefined}
      disabled={!onPress} // Disable touch feedback if no onPress handler is provided
    >
      <View style={styles.header}>
        <View style={styles.operationMarker}>
          <Ionicons
            name={getOperationIconName(log.operationType)}
            size={18}
            color={operationIconColor}
          />
        </View>
        <Ionicons name={entityIcon} size={18} color={entityIconColor} style={styles.entityIcon} />
        <Text style={styles.operationTypeText}>{operationDisplayText}</Text>
      </View>
      {log.userId && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
          <Ionicons
            name="person-circle-outline"
            size={16}
            color={colors.textSecondary}
            style={{ marginRight: 5 }}
          />
          <Text style={styles.entityInfo}>{userDisplayName}</Text>
        </View>
      )}
      <Text style={styles.timestamp}>{formattedDate}</Text>
      <Text style={styles.syncStatus}>
        {t('sync_status')}: {log.isSynced ? t('synced') : t('pending')} (v
        {log.serverOperationVersion})
      </Text>
    </TouchableOpacity>
  );
};

export default OperationLogListItem;
