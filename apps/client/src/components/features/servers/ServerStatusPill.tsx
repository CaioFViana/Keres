import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../../theme';
import { useTheme } from '../../../theme';

export type ServerStatusPillStatus = 'idle' | 'pending' | 'online' | 'offline';

export interface ServerStatusPillProps {
  status: ServerStatusPillStatus;
  /** The API version the server answered with, shown beside the status when known. */
  apiVersion?: string | null;
}

const STATUS_KEYS: Record<ServerStatusPillStatus, string> = {
  idle: 'server_status_idle',
  pending: 'server_status_checking',
  online: 'server_status_online',
  offline: 'server_status_offline',
};

const dotColor = (status: ServerStatusPillStatus, colors: ThemeColors) => {
  switch (status) {
    case 'pending':
      return '#FFD700'; // Gold: still asking
    case 'online':
      return '#32CD32'; // Lime green
    case 'offline':
      return colors.error;
    default:
      return colors.textSecondary;
  }
};

/** Whether the server answers, in words and colour - and which API version it runs, when it does. */
const ServerStatusPill: React.FC<ServerStatusPillProps> = ({ status, apiVersion }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const color = dotColor(status, colors);

  return (
    <View style={[styles.pill, { borderColor: color }]} accessibilityRole="text">
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>
        {t(STATUS_KEYS[status])}
        {status === 'online' && apiVersion
          ? ` · ${t('server_api_version', { version: apiVersion })}`
          : ''}
      </Text>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      paddingVertical: 3,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    text: { fontSize: 12, fontWeight: '600', color: colors.text },
  });

export default ServerStatusPill;
