import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation, StackActions } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { ServerSelect } from '../../db/schema';
import { ServerManagementStackParamList } from '../../navigation/StorySelectionStack'; // Updated import
import apiClient from '../../services/apiClient'; // Import axios and AxiosError
import { createServerService } from '../../services/ServerService';
import { useTheme } from '../../theme';
import { getCommonCardStyles, getCommonContainerStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter'; // Add entityEventEmitter

interface ServerWithStatus extends ServerSelect {
  pingStatus: 'idle' | 'pending' | 'online' | 'offline';
  apiVersion: string | null;
}

type ServerManagementScreenNavigationProp = NativeStackNavigationProp<ServerManagementStackParamList, 'ServerManagement'>;

const ServerManagementScreen = () => {
  useBackButtonHandler()
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ServerManagementScreenNavigationProp>();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonCardStyles = getCommonCardStyles(colors);
  const drizzleDb = useDrizzle();
  const serverService = useRef(createServerService(drizzleDb)).current;
  const isFocused = useIsFocused();

  const [servers, setServers] = useState<ServerWithStatus[]>([]);
  const [loading, setLoading] = useState(true); // Set to true initially to load servers
  const [error, setError] = useState<string | null>(null);

  // Ref to hold the latest servers state
  const serversRef = useRef<ServerWithStatus[]>(servers);

  // Keep the ref updated whenever servers state changes
  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  const pingServer = async (server: ServerWithStatus): Promise<ServerWithStatus> => {
    try {
      const checkUrl = `${server.url}/kerescheck`;
      const response = await apiClient.get(checkUrl, {
        timeout: 5000, // 5 seconds timeout
        validateStatus: () => true, // Always resolve, don't reject on HTTP status codes
      });

      if (response.status === 200 && response.data && typeof response.data.version === 'string') {
        return { ...server, pingStatus: 'online', apiVersion: response.data.version };
      } else {
        return { ...server, pingStatus: 'offline', apiVersion: null };
      }
    } catch (err) {
      return Promise.resolve({ ...server, pingStatus: 'offline', apiVersion: null });
    }
  };

  const loadServers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedServers = await serverService.getAllServers();
      const serversWithStatus: ServerWithStatus[] = fetchedServers.map(s => ({
        ...s,
        pingStatus: 'idle', // Initialize ping status
        apiVersion: null, // Initialize version
      }));
      setServers(serversWithStatus);
    } catch (err) {
      console.error('Failed to load servers:', err);
      setError(t('failed_to_load_servers'));
    } finally {
      setLoading(false);
    }
  }, [serverService, t]);

  const pingAllServers = useCallback(async () => {
    const currentServersToPing = serversRef.current;

    // Set all to 'pending' first
    setServers(prevServers =>
      prevServers.map(server => ({ ...server, pingStatus: 'pending' }))
    );

    // Then, ping them and update their status
    const updatedServers = await Promise.all(
      currentServersToPing.map(server => pingServer(server))
    );

    setServers(updatedServers);
  }, []);

  useEffect(() => {
    if (isFocused) {
      loadServers(); // Load servers when screen is focused
      const intervalId = setInterval(pingAllServers, 7000); // Ping every 7 seconds
      return () => clearInterval(intervalId); // Cleanup on unmount or unfocus
    }
  }, [isFocused, loadServers, pingAllServers]);

  // Add this useEffect block for navigation reset
  useEffect(() => {
    const handleReset = () => {
      if (navigation.getState().routes.length > 1) {
        navigation.dispatch(StackActions.popToTop());
      }
    };
    entityEventEmitter.on('server_management_navigation_reset', handleReset);
    return () => {
      entityEventEmitter.off('server_management_navigation_reset', handleReset);
    };
  }, [navigation]);

  const handleDeleteServer = (serverId: string) => {
    Alert.alert(
      t('delete_server_title'),
      t('delete_server_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          onPress: async () => {
            try {
              await serverService.deleteServer(serverId); // Delete from the database
              setServers(prev => prev.filter(server => server.id !== serverId)); // Update servers state directly
              Alert.alert(t('success'), t('server_deleted_successfully'));
            } catch (err) {
              console.error('Failed to delete server:', err);
              Alert.alert(t('error'), t('failed_to_delete_server'));
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const getPingIconColor = (status: ServerWithStatus['pingStatus']) => {
    switch (status) {
      case 'pending':
        return '#FFD700'; // Gold/Yellow
      case 'online':
        return '#32CD32'; // Lime Green
      case 'offline':
        return colors.error; // Red
      case 'idle':
      default:
        return colors.textSecondary; // Grayish
    }
  };

  const renderServerItem = ({ item }: { item: ServerWithStatus }) => (
    <View style={[commonCardStyles.cardContainer, styles.serverItem, { borderColor: colors.border }]}>
      <View style={styles.serverInfo}>
        <Text style={[styles.serverName, { color: colors.text }]}>{item.name}</Text>
        <Text style={[styles.serverUrl, { color: colors.textSecondary }]}>{item.url}</Text>
        <Text style={[styles.serverUser, { color: colors.textSecondary }]}>User: {item.userName}</Text>
        {item.lastSyncDate && (
          <Text style={[styles.serverDetail, { color: colors.textSecondary }]}>
            {t('last_sync')}: {new Date(item.lastSyncDate).toLocaleString()}
          </Text>
        )}
        <Text style={[styles.serverDetail, { color: colors.textSecondary }]}>
            Version: {item.version}
        </Text>
      </View>
      <View style={styles.serverActions}>
        <Ionicons
          name="pulse-outline"
          size={24}
          color={getPingIconColor(item.pingStatus)}
          style={{ marginRight: 10 }}
        />
        <TouchableOpacity onPress={() => navigation.navigate('ServerRegistration', { serverId: item.id })}>
          <Ionicons name="pencil-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteServer(item.id)} style={{ marginLeft: 10 }}>
          <Ionicons name="trash-outline" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 10 }}>{t('loading_servers')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.error }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={commonContainerStyles.container}>
      <FlatList
        data={servers}
        renderItem={renderServerItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('no_servers_found')}</Text>}
        contentContainerStyle={styles.listContentContainer}
      />
      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('ServerRegistration', {})}
      >
        <Ionicons name="add-outline" size={30} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  listContentContainer: {
    paddingBottom: 80, // To prevent floating button from obscuring last item
  },
  serverItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  serverInfo: {
    flex: 1,
  },
  serverName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  serverUrl: {
    fontSize: 14,
  },
  serverUser: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  serverDetail: {
    fontSize: 12,
  },
  serverActions: {
    flexDirection: 'row',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default ServerManagementScreen;
