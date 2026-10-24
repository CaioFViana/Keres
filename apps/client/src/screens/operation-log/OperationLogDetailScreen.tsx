import ScreenSection from '@/src/components/layout/ScreenSection/ScreenSection';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { commonScreenStyleDefs } from '@/src/theme/commonStyles';
import { Ionicons } from '@expo/vector-icons';
import {
  ISO_DATE_PATTERN,
  OperationLogEntityType,
  resolveEntityReferenceFieldType,
  suggestionDisplayValue,
} from '@keres/shared';
import { entityFieldMetadata } from '@keres/shared/metadata/entityFields';
import type { RouteProp } from '@react-navigation/native';
import { useRoute } from '@react-navigation/native';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '@/src/db';
import type { OperationLogSelect } from '@/src/db/schema'; // Ensure this path is correct
import { useEntityName } from '@/src/hooks/entity/useEntityName';
import { useUserDisplayName } from '@/src/hooks/social/useUserDisplayName';
import type { OperationLogStackParamList } from '@/src/navigation/drawer/MainSystemDrawer'; // Corrected import path
import { EntityService } from '@/src/services/entity-solvers/EntityService';
import { createOperationLogService } from '@/src/services/sync/OperationLogService';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { type ThemeColors, useTheme } from '@/src/theme';
import { layout } from '@/src/theme/layout';
import { typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';
import { useEntityEventSubscriptions } from '@/src/hooks/lists/useEntityRefreshLifecycle';
import { useLoadedResource } from '@/src/hooks/lists/useLoadedResource';

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
    default:
      return 'help-circle-outline';
  }
};

type OperationLogDetailScreenRouteProp = RouteProp<
  OperationLogStackParamList,
  'OperationLogDetail'
>;

const OperationLogDetailScreen: React.FC = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const { t } = useTranslation();

  const route = useRoute<OperationLogDetailScreenRouteProp>();
  const { logId } = route.params;
  const { userId } = useUserSettingsStore();

  const drizzleDb = useDrizzle();
  const operationLogService = useMemo(
    () => (drizzleDb ? createOperationLogService(drizzleDb) : null),
    [drizzleDb],
  );

  const load = useMemo(
    () =>
      operationLogService && logId
        ? async () =>
            (await operationLogService.getOperationLogById(logId, userId ?? undefined)) ?? null
        : null,
    [operationLogService, logId, userId],
  );
  const {
    data: operationLog,
    loading,
    failed,
    reload,
  } = useLoadedResource<OperationLogSelect | null>({
    load,
    initial: null,
    label: 'operation log details',
  });
  const error = failed ? t('failed_to_load_operation_log_details') : null;

  // Without this, the Synchronization Status shown is only a snapshot of the moment the screen opened -
  // if the push/pull finishes synchronizing this operation seconds later (the common case, since
  // the screen tends to be opened before the next sync cycle runs), "Pending (v0)" stays stuck
  // there forever until the person leaves and comes back. The same event OperationLogListScreen already uses
  // to refresh itself. The story of the log is only known once it is read, so this is not the
  // resource's own `storyId` filter.
  const subscriptions = useMemo(
    () => [
      {
        event: 'operation_log_updated' as const,
        listener: (updatedStoryId: string) => {
          if (!operationLog || operationLog.storyId === updatedStoryId) void reload();
        },
      },
    ],
    [operationLog, reload],
  );
  useEntityEventSubscriptions(subscriptions);

  useScreenHeader({
    target: 'parent',
    title: t('operation_log_detail_title'),
  });

  const { entityName: mainEntityName, loading: mainEntityLoading } = useEntityName(
    operationLog?.entityType as OperationLogEntityType,
    operationLog?.entityId || '',
    operationLog?.storyId || '',
  );

  const userDisplayName = useUserDisplayName(
    operationLog?.userId || '',
    operationLog?.storyId || '',
  );

  const styles = useThemedStyles(createStyles);

  if (loading || mainEntityLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedText tone="secondary" style={{ marginTop: 10 }}>
          {t('loading_details')}...
        </ThemedText>
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
          <View style={layout.row}>
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
            <ScreenSection title={t('operation_log_changes_title')} />
            {Object.keys(payload).length === 0 ? (
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
                    <View style={layout.row}>
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

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    headerTitle: {
      fontSize: 18,
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
    changeValue: {
      ...typography.bodyLarge,
      color: colors.text,
      flexShrink: 1,
    },
    emptyValue: {
      ...typography.bodyLarge,
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
  });

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
  const load = useMemo(
    () => () =>
      EntityService.getEntityIdentifier(db, entityType.toLowerCase(), entityId, storyId, t).catch(
        () => undefined,
      ),
    [db, entityType, entityId, storyId, t],
  );
  const { data: name, loading } = useLoadedResource<string | undefined>({
    load,
    initial: undefined,
    label: 'the entity name',
  });

  return <Text style={style}>{loading ? '…' : name || entityId}</Text>;
};

export default OperationLogDetailScreen;
