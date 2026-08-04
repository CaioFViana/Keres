import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { ServerSelect } from '../../db/schema';
import { ServerManagementStackParamList } from '../../navigation/StorySelectionStack'; // Updated import
import apiClient, { isOfflineError } from '../../services/apiClient'; // Import axios and AxiosError
import { createServerService } from '../../services/ServerService';
import { userApiService } from '../../services/UserApiService';
import { useTheme } from '../../theme';
import { getCommonCardStyles, getCommonContainerStyles } from '../../theme/commonStyles';

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
  const [editingTagServerId, setEditingTagServerId] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState('');
  const [savingTag, setSavingTag] = useState(false);

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
    } catch {
      return Promise.resolve({ ...server, pingStatus: 'offline', apiVersion: null });
    }
  };

  /**
   * Re-reads the servers from the local DB (so fields like `lastSyncDate`, kept fresh by
   * the background sync engine, show up without needing to leave and re-enter the screen)
   * and pings them right away - not on a delay, so the pulse icon isn't stuck gray/idle
   * until the first interval tick fires.
   */
  const loadAndPingServers = useCallback(async () => {
    try {
      const fetchedServers = await serverService.getAllServers();
      const serversWithStatus: ServerWithStatus[] = fetchedServers.map(s => ({
        ...s,
        pingStatus: 'pending',
        apiVersion: null,
      }));
      setServers(serversWithStatus);
      setError(null);

      if (serversWithStatus.length > 0) {
        const pinged = await Promise.all(serversWithStatus.map(pingServer));
        setServers(pinged);
      }
    } catch (err) {
      console.error('Failed to load servers:', err);
      setError(t('failed_to_load_servers'));
    }
  }, [serverService, t]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    loadAndPingServers().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    const intervalId = setInterval(loadAndPingServers, 7000); // Refresh + ping every 7 seconds
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [isFocused, loadAndPingServers]);

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

  const handleStartEditTag = (server: ServerWithStatus) => {
    setEditingTagServerId(server.id);
    setEditingTagValue(server.tag || '');
  };

  const handleCancelEditTag = () => {
    setEditingTagServerId(null);
    setEditingTagValue('');
  };

  const handleSaveTag = async (server: ServerWithStatus) => {
    const newTag = editingTagValue.trim();
    if (!newTag || newTag === server.tag) {
      handleCancelEditTag();
      return;
    }

    setSavingTag(true);
    try {
      const updated = await userApiService.updateOwnTag(server, newTag);
      await serverService.updateServer(server.id, { tag: updated.tag });
      setServers(prev => prev.map(s => (s.id === server.id ? { ...s, tag: updated.tag } : s)));
      handleCancelEditTag();
    } catch (err: any) {
      if (isOfflineError(err)) {
        Alert.alert(t('error'), t('server_unreachable'));
      } else if (err?.response?.status === 409) {
        Alert.alert(t('error'), t('tag_already_taken'));
      } else if (err?.response?.status === 400) {
        Alert.alert(t('error'), t('invalid_tag_format'));
      } else {
        Alert.alert(t('error'), t('failed_to_update_tag'));
      }
    } finally {
      setSavingTag(false);
    }
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
        {editingTagServerId === item.id ? (
          <View style={styles.tagEditRow}>
            <Text style={[styles.tagAtPrefix, { color: colors.textSecondary }]}>@</Text>
            <TextInput
              style={[styles.tagInput, { color: colors.text, borderColor: colors.border }]}
              value={editingTagValue}
              onChangeText={setEditingTagValue}
              autoCapitalize="none"
              autoFocus
              editable={!savingTag}
            />
            {savingTag ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
            ) : (
              <>
                <TouchableOpacity onPress={() => handleSaveTag(item)} style={{ marginLeft: 8 }}>
                  <Ionicons name="checkmark-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancelEditTag} style={{ marginLeft: 8 }}>
                  <Ionicons name="close-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.tagEditRow} onPress={() => handleStartEditTag(item)}>
            <Text style={[styles.serverTag, { color: colors.primary }]}>
              {item.tag ? `@${item.tag}` : t('no_tag_set')}
            </Text>
            <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        )}
        {item.lastSyncDate && (
          <Text style={[styles.serverDetail, { color: colors.textSecondary }]}>
            {t('last_sync')}: {new Date(item.lastSyncDate).toLocaleString()}
          </Text>
        )}
      </View>
      <View style={styles.serverActions}>
        <Ionicons
          name="pulse-outline"
          size={24}
          color={getPingIconColor(item.pingStatus)}
          style={{ marginRight: 10 }}
        />
        <TouchableOpacity onPress={() => navigation.navigate('MyProfile', { serverId: item.id })} style={{ marginRight: 10 }}>
          <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('ChangePassword', { serverId: item.id })} style={{ marginRight: 10 }}>
          <Ionicons name="key-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
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
  serverTag: {
    fontSize: 13,
    fontWeight: '600',
  },
  tagEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 2,
  },
  tagAtPrefix: {
    fontSize: 13,
  },
  tagInput: {
    fontSize: 13,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    width: 140,
    height: 30,
    marginBottom: 0,
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
