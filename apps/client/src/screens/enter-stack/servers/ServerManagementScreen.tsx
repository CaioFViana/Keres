import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@/src/utils/format/formatDateTime';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import DefaultServerCard from '@/src/components/features/servers/DefaultServerCard';
import ServerListItem from '@/src/components/features/servers/ServerListItem';
import { useServerStatuses } from '@/src/screens/enter-stack/servers/useServerStatuses';
import type { ServerWithStatus } from '@/src/services/servers/ServerStatusService';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { useUnseenMessagesStore } from '@/src/state/ui/unseenMessagesStore';
import { defaultServerUrl, isDefaultServerUrl } from '@/src/utils/auth/defaultServer';
import { adminConversationKey } from '@/src/utils/entity/conversationKey';
import { isHostedByApi } from '@/src/utils/platform/clientFlavor';
import type { ServerManagementStackParamList } from '@/src/navigation/stacks/StorySelectionStack';
import { useTheme } from '@/src/theme';
import { getCommonContainerStyles } from '@/src/theme/commonStyles';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

type ServerManagementScreenNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'ServerManagement'
>;

/**
 * The default server first - the invitation to register on it, or the account already there - and then
 * the other servers this device knows, each with whether it answers. Adding a server by address is
 * offered only while community servers are allowed. Everything the user can do with a server -
 * profile, password, connection, messages, removal - is on the server's own screen.
 */
const ServerManagementScreen = () => {
  useBackButtonHandler();
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ServerManagementScreenNavigationProp>();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const { servers, loading, error } = useServerStatuses();
  const unseen = useUnseenMessagesStore((state) => state.unseen);
  const allowCommunityServers = useUserSettingsStore((state) => state.allowCommunityServers);
  const hosted = isHostedByApi();
  // The hosted client talks to the one server that serves it: there is no other address to add.
  const canAddByUrl = allowCommunityServers && !hosted;

  const addServer = () => navigation.navigate('ServerRegistration', {});

  useScreenHeader({
    target: 'parent',
    title: t('manage_servers'),
    actions: canAddByUrl
      ? [{ id: 'action-0', icon: 'add', label: t('add_server_by_url'), onPress: addServer }]
      : [],
  });

  if (loading) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <ThemedText style={{ marginTop: 10 }}>{t('loading_servers')}</ThemedText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <ThemedText tone="error">{error}</ThemedText>
      </View>
    );
  }

  const defaultServer = servers.find((server) => isDefaultServerUrl(server.url));
  // Servers already saved are never hidden, whatever the setting says: their stories sync through them.
  const otherServers = servers.filter((server) => server !== defaultServer);

  const renderServer = (item: ServerWithStatus) => (
    <ServerListItem
      key={item.id}
      name={item.name}
      url={item.url}
      userName={item.userName}
      tag={item.tag}
      lastSync={item.lastSyncDate ? formatDateTime(item.lastSyncDate, i18n.language) : null}
      status={item.pingStatus}
      apiVersion={item.apiVersion}
      hasUnseenAdminMessage={unseen[adminConversationKey(item.id)] !== undefined}
      onPress={() => navigation.navigate('ServerDetail', { serverId: item.id })}
    />
  );

  const header = (
    <View>
      {defaultServer ? (
        renderServer(defaultServer)
      ) : (
        <DefaultServerCard
          url={defaultServerUrl()}
          hosted={hosted}
          onPress={() => navigation.navigate('ServerRegistration', { address: defaultServerUrl() })}
        />
      )}
      {otherServers.length > 0 ? (
        <ThemedText tone="secondary" style={styles.sectionTitle} testID="other-servers-title">
          {t('other_servers_title')}
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <View style={commonContainerStyles.container}>
      <FlatList
        data={otherServers}
        renderItem={({ item }) => renderServer(item)}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={
          canAddByUrl ? (
            <Button onPress={addServer} variant="secondary" testID="add-server-by-url">
              {t('add_server_by_url')}
            </Button>
          ) : null
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { marginBottom: 8, fontWeight: '600' },
});

export default ServerManagementScreen;
