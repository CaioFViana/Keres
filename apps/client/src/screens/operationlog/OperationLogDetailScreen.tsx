import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { Ionicons } from '@expo/vector-icons'; // Import Ionicons
import { OperationLogEntityType } from '@keres/shared';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { OperationLogSelect } from '../../db/schema'; // Ensure this path is correct
import { useEntityName } from '../../hooks/useEntityName';
import { useUserDisplayName } from '../../hooks/useUserDisplayName';
import { OperationLogStackParamList } from '../../navigation/MainSystemStack'; // Corrected import path
import { createOperationLogService } from '../../services/OperationLogService';
import { useTheme } from '../../theme';

type OperationLogDetailScreenRouteProp = RouteProp<OperationLogStackParamList, 'OperationLogDetail'>;
type OperationLogDetailScreenNavigationProp = NativeStackNavigationProp<OperationLogStackParamList, 'OperationLogDetail'>;

const OperationLogDetailScreen: React.FC = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<OperationLogDetailScreenNavigationProp>();
  const route = useRoute<OperationLogDetailScreenRouteProp>();
  const { logId } = route.params;

  const drizzleDb = useDrizzle();
  const [operationLog, setOperationLog] = useState<OperationLogSelect | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationLogService, setOperationLogService] = useState<ReturnType<typeof createOperationLogService> | null>(null);

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
      const log = await operationLogService.getOperationLogById(logId);
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
  }, [operationLogService, logId, t]);

  useEffect(() => {
    fetchOperationLogDetails();
  }, [fetchOperationLogDetails]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        title: t('operation_log_detail_title'),
      });
    }, [navigation, t])
  );

  const { entityName: mainEntityName, loading: mainEntityLoading } = useEntityName(
    operationLog?.entityType as OperationLogEntityType,
    operationLog?.entityId || '',
    operationLog?.storyId || ''
  );

  const userDisplayName = useUserDisplayName(operationLog?.userId || '', operationLog?.storyId || '');

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollViewContent: {
      padding: 15,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 20,
      textAlign: 'center',
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingBottom: 5,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textSecondary,
    },
    detailValue: {
      fontSize: 16,
      color: colors.text,
      flexShrink: 1, // Allow text to wrap
      textAlign: 'right',
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
    payloadHeader: {
      marginTop: 20,
      marginBottom: 10,
      textAlign: 'center',
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    checkmarkIcon: {
      color: colors.primary, // Assuming a 'success' color exists in the theme
    },
    xIcon: {
      color: colors.error, // Assuming an 'error' color exists in the theme
    },
  });

  if (loading || mainEntityLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 10 }}>{t('loading_details')}...</Text>
      </View>
    );
  }

  if (error) {
    return <Text style={styles.errorText}>{error}</Text>;
  }

  if (!operationLog) {
    return <Text style={styles.errorText}>{t('operation_log_not_found')}</Text>;
  }

  const formattedDate = operationLog.createdAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  // Removed formattedUpdatedAt as `updatedAt` is not in schema

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <Text style={styles.title}>{t('operation_log_detail_title')}</Text>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('id')}:</Text>
          <Text style={styles.detailValue}>{operationLog.id}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('story')}:</Text>
          <Text style={styles.detailValue}>{operationLog.storyId}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('user')}:</Text>
          <Text style={styles.detailValue}>{userDisplayName}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('entity_type')}:</Text>
          <Text style={styles.detailValue}>{t(operationLog.entityType)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('entity_name')}:</Text>
          <Text style={styles.detailValue}>{mainEntityName || t('unknown_entity')}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('operation_type')}:</Text>
          <Text style={styles.detailValue}>{t(operationLog.operationType)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('server_operation_version')}:</Text>
          <Text style={styles.detailValue}>{operationLog.serverOperationVersion}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('is_synced')}:</Text>
          <Text style={styles.detailValue}>{operationLog.isSynced ? t('yes') : t('no')}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>{t('created_at')}:</Text>
          <Text style={styles.detailValue}>{formattedDate}</Text>
        </View>

        {operationLog.payload && (
          <View>
            <Text style={styles.payloadHeader}>{t('payload')}:</Text>
            {Object.entries(JSON.parse(operationLog.payload)).map(([key, value]) => (
              <View key={key} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{key}:</Text>
                {typeof value === 'boolean' ? (
                  value ? (
                    <Ionicons name="checkmark-circle" size={24} style={styles.checkmarkIcon} />
                  ) : (
                    <Ionicons name="close-circle" size={24} style={styles.xIcon} />
                  )
                ) : (
                  <Text style={styles.detailValue}>{String(value)}</Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default OperationLogDetailScreen;