import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import ServerListItem from '../../components/features/servers/ServerListItem';
import { useServerStatuses } from '../../hooks/useServerStatuses';
import { useUnseenMessagesStore } from '../../state/unseenMessagesStore';
import { adminConversationKey } from '../../utils/conversationKey';
import type { ServerManagementStackParamList } from '../../navigation/StorySelectionStack';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

type ServerManagementScreenNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'ServerManagement'
>;

/**
 * The servers this device knows, each with whether it answers. Everything the user can do with one
 * - profile, password, connection, messages, removal - is on the server's own screen.
 */
const ServerManagementScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ServerManagementScreenNavigationProp>();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const { servers, loading, error } = useServerStatuses();
  const unseen = useUnseenMessagesStore((state) => state.unseen);

  useScreenHeader({
    target: 'parent',
    title: t('manage_servers'),
    actions: [
      {
        id: 'action-0',
        icon: 'add',
        label: t('register_new_server'),
        onPress: () => navigation.navigate('ServerRegistration', {}),
      },
    ],
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

  return (
    <View style={commonContainerStyles.container}>
      <FlatList
        data={servers}
        renderItem={({ item }) => (
          <ServerListItem
            name={item.name}
            url={item.url}
            userName={item.userName}
            tag={item.tag}
            lastSync={item.lastSyncDate ? new Date(item.lastSyncDate).toLocaleString() : null}
            status={item.pingStatus}
            apiVersion={item.apiVersion}
            hasUnseenAdminMessage={unseen[adminConversationKey(item.id)] !== undefined}
            onPress={() => navigation.navigate('ServerDetail', { serverId: item.id })}
          />
        )}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <ThemedText tone="secondary" style={{ textAlign: 'center' }}>
            {t('no_servers_found')}
          </ThemedText>
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
});

export default ServerManagementScreen;
