import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import PlanStatusCard from '../../components/features/servers/PlanStatusCard';
import ServerActionRow from '../../components/features/servers/ServerActionRow';
import ServerStatusPill from '../../components/features/servers/ServerStatusPill';
import { useDrizzle } from '../../db';
import { usePaymentOverview } from '../../hooks/usePaymentOverview';
import { useServerDeletion } from '../../hooks/useServerDeletion';
import { useServerStatuses } from '../../hooks/useServerStatuses';
import { useServerTagEditor } from '../../hooks/useServerTagEditor';
import type { ServerManagementStackParamList } from '../../navigation/StorySelectionStack';
import { createServerService } from '../../services/ServerService';
import { useIsConversationUnseen } from '../../state/unseenMessagesStore';
import { userApiService } from '../../services/UserApiService';
import { useTheme } from '../../theme';
import { adminConversationKey } from '../../utils/conversationKey';

type ServerDetailRouteProp = RouteProp<ServerManagementStackParamList, 'ServerDetail'>;
type ServerDetailNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'ServerDetail'
>;

interface OwnProfile {
  avatarColor: string | null;
  avatarIcon: string | null;
}

/**
 * One server in detail: whether it answers, who the user is there, and everything that can be done
 * with it - messages to its administrators, profile and avatar, password, the connection, removal.
 */
const ServerDetailScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ServerDetailNavigationProp>();
  const { serverId } = useRoute<ServerDetailRouteProp>().params;
  const drizzleDb = useDrizzle();
  const [serverService] = useState(() => createServerService(drizzleDb));
  const { servers, loading, error, updateTag } = useServerStatuses(serverId);
  const server = servers[0];
  const [profile, setProfile] = useState<OwnProfile | null>(null);

  useScreenHeader({ target: 'parent', title: server?.name ?? t('server_detail_title') });

  const tagEditor = useServerTagEditor(server, serverService, updateTag);
  const deleteServer = useServerDeletion(serverService, () => navigation.goBack());

  // The avatar is the user's own on this server: it is read once the server answers, and the
  // generated one stands in until then (and when it never does).
  const online = server?.pingStatus === 'online';
  useEffect(() => {
    if (!server || !online || profile) return;
    let cancelled = false;
    userApiService
      .getOwnProfile(server)
      .then((own) => {
        if (!cancelled && own) setProfile(own);
      })
      .catch(() => {
        // The avatar is a nicety: without it the generated one stays.
      });
    return () => {
      cancelled = true;
    };
  }, [server, online, profile]);

  // Plans and payment appear only while the server answers and only if it sells plans: a user working offline,
  // or on a server with no payment plugin, is never shown (or asked for) anything about payment.
  const { overview: payments } = usePaymentOverview(server, online);

  const hasUnseenAdminMessage = useIsConversationUnseen(adminConversationKey(serverId));

  const openMessages = () => {
    navigation.navigate('Conversation', { serverId, peer: 'admin' });
  };

  const styles = StyleSheet.create({
    header: { alignItems: 'center', marginBottom: 20, gap: 8 },
    name: { fontSize: 22, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
    url: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      marginBottom: 20,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lastRow: { borderBottomWidth: 0 },
    label: { fontSize: 14, color: colors.textSecondary },
    value: { flexShrink: 1, fontSize: 14, color: colors.text, textAlign: 'right' },
    tagEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tagAt: { fontSize: 14, color: colors.textSecondary },
    tagInput: {
      fontSize: 14,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      width: 140,
      height: 32,
      marginBottom: 0,
      color: colors.text,
    },
    tagValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    tagText: { fontSize: 14, fontWeight: '600', color: colors.primary },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: 8,
    },
  });

  if (loading && !server) {
    return <ScreenLoading message={t('loading_servers')} />;
  }
  if (error || !server) {
    return (
      <ScreenError message={error ?? t('server_not_found')} onGoBack={() => navigation.goBack()} />
    );
  }

  const field = (label: string, value: string, last = false) => (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} selectable>
        {value}
      </Text>
    </View>
  );

  return (
    <DetailContainer>
      <View style={styles.header}>
        <Avatar
          color={profile?.avatarColor}
          icon={profile?.avatarIcon}
          seed={server.idUser}
          size={80}
        />
        <Text style={styles.name}>{server.name}</Text>
        <Text style={styles.url} selectable>
          {server.url}
        </Text>
        <ServerStatusPill status={server.pingStatus} apiVersion={server.apiVersion} />
      </View>

      <View style={styles.card}>
        {field(t('server_user_field'), server.userName)}
        <View style={styles.row}>
          <Text style={styles.label}>{t('server_tag_field')}</Text>
          {tagEditor.editing ? (
            <View style={styles.tagEditRow}>
              <Text style={styles.tagAt}>@</Text>
              <TextInput
                style={styles.tagInput}
                value={tagEditor.value}
                onChangeText={tagEditor.setValue}
                autoCapitalize="none"
                autoFocus
                editable={!tagEditor.saving}
                accessibilityLabel={t('server_tag_field')}
              />
              {tagEditor.saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => void tagEditor.save()}
                    accessibilityRole="button"
                    accessibilityLabel={t('save')}
                  >
                    <Ionicons name="checkmark-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={tagEditor.cancel}
                    accessibilityRole="button"
                    accessibilityLabel={t('cancel')}
                  >
                    <Ionicons name="close-outline" size={22} color={colors.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={styles.tagValue}
              onPress={tagEditor.start}
              accessibilityRole="button"
              accessibilityLabel={t('server_tag_field')}
            >
              <Text style={styles.tagText}>{server.tag ? `@${server.tag}` : t('no_tag_set')}</Text>
              <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {server.apiVersion ? field(t('server_api_version_field'), server.apiVersion) : null}
        {field(
          t('last_sync'),
          server.lastSyncDate
            ? new Date(server.lastSyncDate).toLocaleString()
            : t('server_never_synced'),
          true,
        )}
      </View>

      {payments?.info.subscription ? (
        <>
          <Text style={styles.sectionTitle}>{t('server_plan_section')}</Text>
          <PlanStatusCard subscription={payments.info.subscription} />
        </>
      ) : null}

      <Text style={styles.sectionTitle}>{t('server_detail_actions')}</Text>
      <ServerActionRow
        icon="chatbubbles-outline"
        title={t('server_action_messages')}
        description={t('server_action_messages_hint')}
        onPress={openMessages}
        badge={hasUnseenAdminMessage}
        badgeLabel={t('messages_unseen_admin_on', { server: server.name })}
        testID="server-action-messages"
      />
      {payments ? (
        <ServerActionRow
          icon="card-outline"
          title={t('server_action_plan')}
          description={t('server_action_plan_hint')}
          onPress={() => navigation.navigate('ServerPlan', { serverId })}
          testID="server-action-plan"
        />
      ) : null}
      {payments ? (
        <ServerActionRow
          icon="receipt-outline"
          title={t('server_action_payment_history')}
          description={t('server_action_payment_history_hint')}
          onPress={() => navigation.navigate('ServerPaymentHistory', { serverId })}
          testID="server-action-payment-history"
        />
      ) : null}
      <ServerActionRow
        icon="person-circle-outline"
        title={t('server_action_profile')}
        description={t('server_action_profile_hint')}
        onPress={() => navigation.navigate('MyProfile', { serverId })}
        testID="server-action-profile"
      />
      <ServerActionRow
        icon="key-outline"
        title={t('server_action_password')}
        description={t('server_action_password_hint')}
        onPress={() => navigation.navigate('ChangePassword', { serverId })}
        testID="server-action-password"
      />
      <ServerActionRow
        icon="create-outline"
        title={t('server_action_connection')}
        description={t('server_action_connection_hint')}
        onPress={() => navigation.navigate('ServerRegistration', { serverId })}
        testID="server-action-connection"
      />
      <ServerActionRow
        icon="trash-outline"
        title={t('server_action_delete')}
        description={t('server_action_delete_hint')}
        destructive
        onPress={() => void deleteServer(serverId)}
        testID="server-action-delete"
      />
    </DetailContainer>
  );
};

export default ServerDetailScreen;
