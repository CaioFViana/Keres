import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../db';
import { ServerSelect } from '../db/schema';
import { createServerService } from '../services/ServerService';
import { useTheme } from '../theme';
import { getCommonCardStyles, getCommonContainerStyles } from '../theme/commonStyles';
import { createULID } from '../utils/ulid';
import { StorySelectionStackParamList } from '../navigation/StorySelectionStack';

interface ServerWithStatus extends ServerSelect {
  pingStatus: 'idle' | 'pending' | 'online' | 'offline';
}

const initialMockServers: ServerWithStatus[] = [
  {
    id: createULID(),
    idUser: 'user123',
    userName: 'KeresUser1',
    name: 'Keres Cloud EU',
    url: 'https://eu.keres.cloud',
    lastSyncDate: new Date(Date.now() - 3600000), // 1 hour ago
    jwtToken: 'mock_jwt_eu',
    refreshToken: 'mock_refresh_eu',
    createdAt: new Date(Date.now() - 86400000 * 5), // 5 days ago
    updatedAt: new Date(Date.now() - 3600000),
    version: 1,
    isDeleted: false,
    deletedAt: null,
    pingStatus: 'idle',
  },
  {
    id: createULID(),
    idUser: 'user456',
    userName: 'KeresUser2',
    name: 'Keres Cloud US',
    url: 'https://us.keres.cloud',
    lastSyncDate: new Date(Date.now() - 7200000), // 2 hours ago
    jwtToken: 'mock_jwt_us',
    refreshToken: 'mock_refresh_us',
    createdAt: new Date(Date.now() - 86400000 * 10), // 10 days ago
    updatedAt: new Date(Date.now() - 7200000),
    version: 1,
    isDeleted: false,
    deletedAt: null,
    pingStatus: 'idle',
  },
];

type ServerManagementScreenNavigationProp = NativeStackNavigationProp<StorySelectionStackParamList, 'ServerManagement'>;

const ServerManagementScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ServerManagementScreenNavigationProp>();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonCardStyles = getCommonCardStyles(colors);
  const drizzleDb = useDrizzle();
  const serverService = useRef(createServerService(drizzleDb)).current;
  const isFocused = useIsFocused();

  const [servers, setServers] = useState<ServerWithStatus[]>(initialMockServers);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref to hold the latest servers state
  const serversRef = useRef<ServerWithStatus[]>(servers);

  // Keep the ref updated whenever servers state changes
  useEffect(() => {
    serversRef.current = servers;
  }, [servers]);

  const pingServer = async (server: ServerWithStatus): Promise<ServerWithStatus> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500)); // 0.5 to 1.5 seconds delay

    const isOnline = Math.random() > 0.3; // 70% chance of being online for mock

    return {
      ...server,
      pingStatus: isOnline ? 'online' : 'offline',
    };
  };

  const pingAllServers = useCallback(async () => {
    const currentServersToPing = serversRef.current; // Get the latest servers from ref

    // First, set all to 'pending'
    setServers(prevServers =>
      prevServers.map(server => ({ ...server, pingStatus: 'pending' }))
    );

    // Then, ping them and update their status
    const updatedServers = await Promise.all(
      currentServersToPing.map(server => pingServer(server))
    );

    setServers(updatedServers);
  }, []); // No dependency on 'servers' here, making pingAllServers stable

  useEffect(() => {
    if (isFocused) {
      pingAllServers(); // Initial ping
      const intervalId = setInterval(pingAllServers, 7000); // Ping every 7 seconds
      return () => clearInterval(intervalId); // Cleanup on unmount or unfocus
    }
  }, [isFocused, pingAllServers]); // Depend on pingAllServers (which is now stable)

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
              // In a real scenario, you would delete from the database
              // await serverService.deleteServer(serverId);
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
          {t('created_at')}: {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
      <View style={styles.serverActions}>
        <Ionicons
          name="pulse-outline"
          size={24}
          color={getPingIconColor(item.pingStatus)}
          style={{ marginRight: 10 }}
        />
        <TouchableOpacity onPress={() => { /* TODO: Implement edit functionality */ }}>
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
        <Text style={{ color: colors.text }}>{t('loading_servers')}</Text>
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
      <Text style={[styles.title, { color: colors.text }]}>{t('manage_servers')}</Text>
      <FlatList
        data={servers}
        renderItem={renderServerItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('no_servers_found')}</Text>}
        contentContainerStyle={styles.listContentContainer}
      />
      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('ServerRegistration')}
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