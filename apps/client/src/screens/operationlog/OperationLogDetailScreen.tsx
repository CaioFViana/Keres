import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { commonScreenStyleDefs } from '../../theme/commonStyles';
import { Ionicons } from '@expo/vector-icons';
import {
  ISO_DATE_PATTERN,
  OperationLogEntityType,
  resolveEntityReferenceFieldType,
  suggestionDisplayValue,
} from '@keres/shared';
import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import type { OperationLogSelect } from '../../db/schema'; // Ensure this path is correct
import { useEntityName } from '../../hooks/useEntityName';
import { useUserDisplayName } from '../../hooks/useUserDisplayName';
import type { OperationLogStackParamList } from '../../navigation/MainSystemStack'; // Corrected import path
import { EntityService } from '../../services/EntityService';
import { createOperationLogService } from '../../services/OperationLogService';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { useDocumentTitle } from '../../utils/documentTitle';

/** "extraNotes" -> "Extra Notes" - fallback for payload keys `entityFieldMetadata` doesn't cover. */
function humanizeFieldName(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

const getOperationIcon = (operationType: string): keyof typeof Ionicons.glyphMap => {
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

type OperationLogDetailScreenRouteProp = RouteProp<
  OperationLogStackParamList,
  'OperationLogDetail'
>;
type OperationLogDetailScreenNavigationProp = NativeStackNavigationProp<
  OperationLogStackParamList,
  'OperationLogDetail'
>;

const OperationLogDetailScreen: React.FC = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const { t } = useTranslation();
  useDocumentTitle(t('operation_log_detail_title'));
  const navigation = useNavigation<OperationLogDetailScreenNavigationProp>();
  const route = useRoute<OperationLogDetailScreenRouteProp>();
  const { logId } = route.params;
  const { userId } = useUserSettingsStore();

  const drizzleDb = useDrizzle();
  const [operationLog, setOperationLog] = useState<OperationLogSelect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationLogService, setOperationLogService] = useState<ReturnType<
    typeof createOperationLogService
  > | null>(null);

  useEffect(() => {
    if (drizzleDb) {
      setOperationLogService(createOperationLogService(drizzleDb));
    }
  }, [drizzleDb]);

  const fetchOperationLogDetails = useCallback(async () => {
    if (!operationLogService || !logId) return;

    setLoading(true);
    setError(null);
    try {
      const log = await operationLogService.getOperationLogById(logId, userId ?? undefined);
      if (log) {
        setOperationLog(log);
      } else {
        setError(t('operation_log_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch operation log details:', err);
      setError(t('failed_to_load_operation_log_details'));
    } finally {
      setLoading(false);
    }
  }, [operationLogService, logId, t, userId]);

  useEffect(() => {
    fetchOperationLogDetails();
  }, [fetchOperationLogDetails]);

  // Without this, the Synchronization Status shown is only a snapshot of the moment the screen opened -
  // if the push/pull finishes synchronizing this operation seconds later (the common case, since
  // the screen tends to be opened before the next sync cycle runs), "Pending (v0)" stays stuck
  // there forever until the person leaves and comes back. The same event OperationLogListScreen already uses
  // to refresh itself.
  useEffect(() => {
    const handleOperationLogUpdated = (updatedStoryId: string) => {
      if (!operationLog || operationLog.storyId === updatedStoryId) {
        fetchOperationLogDetails();
      }
    };
    entityEventEmitter.on('operation_log_updated', handleOperationLogUpdated);
    return () => {
      entityEventEmitter.off('operation_log_updated', handleOperationLogUpdated);
    };
  }, [operationLog, fetchOperationLogDetails]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        title: t('operation_log_detail_title'),
        headerRight: undefined,
      });
    }, [navigation, t]),
  );

  const { entityName: mainEntityName, loading: mainEntityLoading } = useEntityName(
    operationLog?.entityType as OperationLogEntityType,
    operationLog?.entityId || '',
    operationLog?.storyId || '',
  );

  const userDisplayName = useUserDisplayName(
    operationLog?.userId || '',
    operationLog?.storyId || '',
  );

  const styles = StyleSheet.create({
    ...commonScreenStyleDefs(colors),
    scrollViewContent: {
      padding: 15,
      paddingBottom: 30,
    },
    headerCard: {
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 16,
      marginBottom: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 19,
      fontWeight: 'bold',
      color: colors.text,
      marginLeft: 8,
      flexShrink: 1,
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      marginLeft: 30,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
    },
    metaIcon: {
      marginRight: 8,
    },
    metaText: {
      fontSize: 14,
      color: colors.text,
    },
    sectionTitle: {
      marginBottom: 10,
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
    },
    changeCard: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 8,
    },
    changeLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      marginBottom: 4,
    },
    changeValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    changeValue: {
      fontSize: 16,
      color: colors.text,
      flexShrink: 1,
    },
    emptyValue: {
      fontSize: 16,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    jsonValue: {
      fontSize: 13,
      color: colors.text,
      fontFamily: 'monospace',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: {
      color: colors.error,
      textAlign: 'center',
      marginTop: 20,
    },
    reorderItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 6,
      paddingLeft: 6,
    },
    reorderIndex: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.primary,
      width: 28,
    },
  });

  if (loading || mainEntityLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>
          {t('loading_details')}...
        </Text>
      </View>
    );
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  if (!operationLog) {
    return <Text style={styles.errorText}>{t('operation_log_not_found')}</Text>;
  }

  const formattedDate = operationLog.createdAt.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const payload = operationLog.payload ? JSON.parse(operationLog.payload) : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <Ionicons
              name={getOperationIcon(operationLog.operationType)}
              size={22}
              color={colors.primary}
            />
            <Text style={styles.headerTitle} numberOfLines={2}>
              {t(operationLog.operationType)} {mainEntityName || t('unknown_entity')}
            </Text>
          </View>
          <Text style={styles.headerSubtitle}>{t(operationLog.entityType)}</Text>

          <View style={styles.metaRow}>
            <Ionicons
              name="person-circle-outline"
              size={18}
              color={colors.textSecondary}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText}>{userDisplayName}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.textSecondary}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText}>{formattedDate}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name={operationLog.isSynced ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={18}
              color={colors.textSecondary}
              style={styles.metaIcon}
            />
            <Text style={styles.metaText}>
              {operationLog.isSynced ? t('synced') : t('pending')} (v
              {operationLog.serverOperationVersion})
            </Text>
          </View>
        </View>

        {payload && (
          <View>
            <Text style={styles.sectionTitle}>{t('operation_log_changes_title')}</Text>
            {operationLog.operationType === 'reorder' ? (
              <View style={styles.changeCard}>
                {payload.reorderItems.map((item: { id: string; newIndex: number }) => (
                  <View key={item.id} style={styles.reorderItemRow}>
                    <Text style={styles.reorderIndex}>{item.newIndex}.</Text>
                    <ResolvedFieldValue
                      // A 'reorder' recorded on 'Story' reorders Chapters; recorded on
                      // 'Chapter' it reorders that chapter's Scenes (see
                      // ChapterService.reorderChapters / SceneService.reorderScenes).
                      entityType={
                        operationLog.entityType === OperationLogEntityType.Story
                          ? OperationLogEntityType.Chapter
                          : OperationLogEntityType.Scene
                      }
                      entityId={item.id}
                      storyId={operationLog.storyId}
                      style={styles.changeValue}
                    />
                  </View>
                ))}
              </View>
            ) : Object.keys(payload).length === 0 ? (
              <Text style={styles.emptyValue}>{t('operation_log_no_changes')}</Text>
            ) : (
              // Every payload field is already a genuine change (see the services in
              // services/storymanagement/*.ts) - the label comes from entityFieldMetadata when the
              // entity has metadata registered, otherwise from a "humanized" version of the key.
              Object.entries(payload).map(([key, value]) => {
                const fieldMeta = entityFieldMetadata[operationLog.entityType]?.find(
                  (f) => f.name === key,
                );
                const label = fieldMeta ? t(fieldMeta.label) : humanizeFieldName(key);
                const referenceEntityType = resolveEntityReferenceFieldType(key);

                return (
                  <View key={key} style={styles.changeCard}>
                    <Text style={styles.changeLabel}>{label}</Text>
                    <View style={styles.changeValueRow}>
                      {value === null || value === undefined ? (
                        <Text style={styles.emptyValue}>{t('conflict_empty_value')}</Text>
                      ) : typeof value === 'boolean' ? (
                        <Ionicons
                          name={value ? 'checkmark-circle' : 'close-circle'}
                          size={22}
                          color={value ? colors.primary : colors.error}
                        />
                      ) : referenceEntityType && typeof value === 'string' ? (
                        <ResolvedFieldValue
                          entityType={referenceEntityType}
                          entityId={value}
                          storyId={operationLog.storyId}
                          style={styles.changeValue}
                        />
                      ) : typeof value === 'string' && ISO_DATE_PATTERN.test(value) ? (
                        <Text style={styles.changeValue}>
                          {new Date(value).toLocaleString('en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </Text>
                      ) : typeof value === 'object' ? (
                        <Text style={styles.jsonValue}>{JSON.stringify(value, null, 2)}</Text>
                      ) : (
                        <Text style={styles.changeValue}>
                          {operationLog.entityType === OperationLogEntityType.Suggestion &&
                          key === 'value'
                            ? (suggestionDisplayValue(String(value)) ?? String(value))
                            : String(value)}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

/**
 * Resolves a reference ID inside the payload into the name of the entity it points at, through
 * the same resolver `TagRelation`/`NoteRelation`/etc already use (`EntityService`) - not a
 * second implementation. It falls back to the raw ID if the entity no longer exists (deleted) or the
 * resolver does not know the type.
 */
const ResolvedFieldValue: React.FC<{
  entityType: OperationLogEntityType;
  entityId: string;
  storyId: string;
  style: object;
}> = ({ entityType, entityId, storyId, style }) => {
  const db = useDrizzle();
  const { t } = useTranslation();
  const [name, setName] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    EntityService.getEntityIdentifier(db, entityType.toLowerCase(), entityId, storyId, t)
      .then((resolved) => {
        if (isMounted) setName(resolved);
      })
      .catch(() => {
        if (isMounted) setName(undefined);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [db, entityType, entityId, storyId, t]);

  return <Text style={style}>{loading ? '…' : name || entityId}</Text>;
};

export default OperationLogDetailScreen;
