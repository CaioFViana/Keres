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
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DeleteAccountModal from '../../components/features/servers/DeleteAccountModal/DeleteAccountModal';
import PlanLimitsCard from '../../components/features/servers/PlanLimitsCard';
import PlanStatusCard from '../../components/features/servers/PlanStatusCard';
import ServerActionRow from '../../components/features/servers/ServerActionRow';
import TermsModal from '../../components/features/servers/TermsModal/TermsModal';
import { serverCardStyleDefs } from '../../components/features/servers/serverCardStyleDefs';
import ServerStatusPill from '../../components/features/servers/ServerStatusPill';
import { useDrizzle } from '../../db';
import { useAccountPlan } from '../../hooks/useAccountPlan';
import { useAccountVerificationNotice } from '../../hooks/useAccountVerificationNotice';
import { useAgeVerificationInfo } from '../../hooks/useAgeVerificationInfo';
import { formatDateTime } from '../../utils/formatDateTime';
import { usePaymentOverview } from '../../hooks/usePaymentOverview';
import { useServerDeletion } from '../../hooks/useServerDeletion';
import { useServerStatuses } from '../../hooks/useServerStatuses';
import { useServerTagEditor } from '../../hooks/useServerTagEditor';
import type { ServerManagementStackParamList } from '../../navigation/StorySelectionStack';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@keres/shared';
import { exportAccountData } from '../../services/AccountDataExportService';
import { createServerService } from '../../services/ServerService';
import {
  acceptLegal,
  fetchLegalStatus,
  fetchServerPrivacy,
  fetchServerTerms,
  type ServerTerms,
} from '../../services/ServerTermsService';
import {
  AccountDeletionCleanupError,
  deleteServerAccount,
} from '../../services/DeleteAccountService';
import { isOfflineError } from '../../services/apiClient';
import { useIsConversationUnseen } from '../../state/unseenMessagesStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { userApiService } from '../../services/UserApiService';
import { AppAlert } from '../../utils/AppAlert';
import { type ThemeColors, useTheme } from '../../theme';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { typography } from '../../theme/tokens';
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
  const { t, i18n } = useTranslation();
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

  const [termsVisible, setTermsVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteWorking, setDeleteWorking] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // A newer text than the account accepted: fetched only while it lags, accepted here.
  const [legalUpdate, setLegalUpdate] = useState<
    ({ kind: 'tos' | 'privacy' } & ServerTerms) | null
  >(null);
  const [legalUpdateVisible, setLegalUpdateVisible] = useState(false);
  const [acceptWorking, setAcceptWorking] = useState(false);

  // One operation: the account is deleted on the server, its owned stories stay here as local
  // stories, and the server entry is removed from this device (see deleteServerAccount).
  const handleDeleteAccount = async (currentPassword: string) => {
    const currentUserId = useUserSettingsStore.getState().userId;
    if (!server) return;
    if (!currentUserId) {
      setDeleteError(t('failed_to_delete_account'));
      return;
    }
    setDeleteWorking(true);
    setDeleteError(null);
    try {
      await deleteServerAccount(drizzleDb, server, currentPassword, currentUserId);
      setDeleteVisible(false);
      AppAlert.alert(t('success'), t('delete_account_done'));
      navigation.goBack();
    } catch (err) {
      if (err instanceof AccountDeletionCleanupError) {
        // The account is gone and the tokens with it: the server stays listed so the person can finish
        // with "Remove this server", here on this screen.
        setDeleteVisible(false);
        AppAlert.alert(t('error'), t('delete_account_cleanup_failed'));
      } else if (isOfflineError(err)) {
        setDeleteError(t('server_unreachable'));
      } else if ((err as { response?: { status?: number } })?.response?.status === 401) {
        setDeleteError(t('incorrect_current_password'));
      } else {
        setDeleteError(t('failed_to_delete_account'));
      }
    } finally {
      setDeleteWorking(false);
    }
  };

  // "Download my data": the server's answer goes to the person as a file; nothing is kept here.
  const [exportWorking, setExportWorking] = useState(false);
  const handleExportData = async () => {
    if (!server || exportWorking) return;
    setExportWorking(true);
    try {
      const result = await exportAccountData(server);
      if (!result.delivered) AppAlert.alert(t('error'), t('export_data_not_shared'));
    } catch (err) {
      AppAlert.alert(
        t('error'),
        isOfflineError(err) ? t('server_unreachable') : t('export_data_failed'),
      );
    } finally {
      setExportWorking(false);
    }
  };

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

  // The documents move under the account: when the server serves a newer text than the account
  // accepted (or the account predates acceptance records entirely), the fresh text is fetched
  // and the update row below asks for agreement. Offline or predated servers simply skip this.
  useEffect(() => {
    if (!server || !online || legalUpdate || acceptWorking) return;
    let cancelled = false;
    void (async () => {
      const status = await fetchLegalStatus(server);
      if (cancelled || !status) return;
      const laggingKind =
        status.tos.accepted === null || status.tos.accepted < status.tos.current
          ? ('tos' as const)
          : status.privacy.accepted === null || status.privacy.accepted < status.privacy.current
            ? ('privacy' as const)
            : null;
      if (!laggingKind) return;
      const fresh =
        laggingKind === 'tos'
          ? await fetchServerTerms(server.url, i18n.language)
          : await fetchServerPrivacy(server.url, i18n.language);
      if (cancelled || !fresh) return;
      setLegalUpdate({ kind: laggingKind, ...fresh });
    })();
    return () => {
      cancelled = true;
    };
  }, [server, online, legalUpdate, acceptWorking, i18n.language]);

  // Accepting records server-side first: only then is the local copy worth updating.
  const handleAcceptLegalUpdate = async () => {
    if (!server || !legalUpdate || acceptWorking) return;
    setAcceptWorking(true);
    try {
      const status = await acceptLegal(server, legalUpdate.kind);
      if (!status) {
        AppAlert.alert(t('error'), t('server_legal_accept_failed'));
        return;
      }
      const patch =
        legalUpdate.kind === 'tos'
          ? {
              tosText: legalUpdate.text,
              tosVersion: String(legalUpdate.version),
              tosAcceptedAt: new Date(),
            }
          : {
              privacyText: legalUpdate.text,
              privacyVersion: String(legalUpdate.version),
              privacyAcceptedAt: new Date(),
            };
      await serverService.updateServer(server.id, patch);
      setLegalUpdate(null);
      setLegalUpdateVisible(false);
    } finally {
      setAcceptWorking(false);
    }
  };

  // Plans and payment appear only while the server answers and only if it sells plans: a user working offline,
  // or on a server with no payment plugin, is never shown (or asked for) anything about payment.
  const { overview: payments } = usePaymentOverview(server, online);
  // The plan the person has - the free one included - and what it comes with, whether or not the server sells any.
  const { plan } = useAccountPlan(server, online);
  // Whether this server checks ages, said in one line while it answers. A server with no check must never look verified.
  const ageInfo = useAgeVerificationInfo(online ? server?.url : undefined, online);
  // An account still waiting for (or refused in) its age check is sent back to it from here. Asked again when the
  // screen comes back to the front, because the approval may have happened on the verification screen.
  const focused = useIsFocused();
  const verificationNotice = useAccountVerificationNotice(server, online && focused);

  const hasUnseenAdminMessage = useIsConversationUnseen(adminConversationKey(serverId));

  const openMessages = () => {
    navigation.navigate('Conversation', { serverId, peer: 'admin' });
  };

  const styles = useThemedStyles(createStyles);

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
            ? formatDateTime(server.lastSyncDate, i18n.language)
            : t('server_never_synced'),
          true,
        )}
      </View>

      {ageInfo ? (
        <Text style={styles.ageLine} testID="server-age-verification">
          {ageInfo.mode === 'required'
            ? t('age_verification_line_required')
            : t('age_verification_line_disabled')}
        </Text>
      ) : null}

      {plan || payments?.info.subscription ? (
        <>
          <Text style={styles.sectionTitle}>{t('server_plan_section')}</Text>
          {plan ? <PlanLimitsCard plan={plan} /> : null}
          {payments?.info.subscription ? (
            <PlanStatusCard subscription={payments.info.subscription} />
          ) : null}
        </>
      ) : null}

      {verificationNotice ? (
        <ServerActionRow
          icon="shield-checkmark-outline"
          title={t('finish_age_verification')}
          description={t('finish_age_verification_hint')}
          onPress={() => navigation.navigate('ServerVerification', { serverId })}
          testID="server-action-verification"
        />
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
      {legalUpdate ? (
        <ServerActionRow
          icon="alert-circle-outline"
          title={
            legalUpdate.kind === 'tos'
              ? t('server_legal_update_terms_title')
              : t('server_legal_update_privacy_title')
          }
          description={t('server_legal_update_hint')}
          onPress={() => setLegalUpdateVisible(true)}
          testID="server-action-legal-update"
        />
      ) : null}
      {server.tosText ? (
        <ServerActionRow
          icon="document-text-outline"
          title={t('server_action_terms')}
          description={t('server_action_terms_hint', { version: server.tosVersion ?? '' })}
          onPress={() => setTermsVisible(true)}
          testID="server-action-terms"
        />
      ) : null}
      {server.privacyText ? (
        <ServerActionRow
          icon="shield-checkmark-outline"
          title={t('server_action_privacy')}
          description={t('server_action_privacy_hint', { version: server.privacyVersion ?? '' })}
          onPress={() => setPrivacyVisible(true)}
          testID="server-action-privacy"
        />
      ) : null}
      <ServerActionRow
        icon="download-outline"
        title={t('server_action_export_data')}
        description={t('server_action_export_data_hint')}
        onPress={() => void handleExportData()}
        testID="server-action-export-data"
      />
      <ServerActionRow
        icon="person-remove-outline"
        title={t('delete_account')}
        description={t('delete_account_hint')}
        destructive
        onPress={() => {
          setDeleteError(null);
          setDeleteVisible(true);
        }}
        testID="server-action-delete-account"
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
      {server.tosText ? (
        <TermsModal
          visible={termsVisible}
          title={t('server_terms_title')}
          subtitle={t('server_terms_version', {
            version: server.tosVersion ?? '',
            date:
              server.tosAcceptedAt != null
                ? formatDateTime(server.tosAcceptedAt, i18n.language)
                : '',
          })}
          sections={[{ heading: t('server_terms_title'), paragraphs: [server.tosText] }]}
          mode="read"
          onClose={() => setTermsVisible(false)}
          testID="server-terms-modal"
        />
      ) : null}
      {legalUpdate ? (
        <TermsModal
          visible={legalUpdateVisible}
          title={legalUpdate.kind === 'tos' ? t('server_terms_title') : t('server_privacy_title')}
          subtitle={t(
            legalUpdate.kind === 'tos' ? 'server_terms_version' : 'server_privacy_version',
            {
              version: legalUpdate.version,
              date: legalUpdate.updatedAt,
            },
          )}
          sections={legalUpdate.sections}
          mode="accept"
          acceptLabel={t('terms_accept')}
          onAccept={() => void handleAcceptLegalUpdate()}
          onClose={() => setLegalUpdateVisible(false)}
          requireScrollToEnd
          testID="server-legal-update-modal"
        />
      ) : null}
      {server.privacyText ? (
        <TermsModal
          visible={privacyVisible}
          title={t('server_privacy_title')}
          subtitle={t('server_privacy_version', {
            version: server.privacyVersion ?? '',
            date:
              server.privacyAcceptedAt != null
                ? formatDateTime(server.privacyAcceptedAt, i18n.language)
                : '',
          })}
          sections={[{ heading: t('server_privacy_title'), paragraphs: [server.privacyText] }]}
          mode="read"
          onClose={() => setPrivacyVisible(false)}
          testID="server-privacy-modal"
        />
      ) : null}
      <DeleteAccountModal
        visible={deleteVisible}
        serverName={server.name}
        eraseDays={ACCOUNT_DELETION_GRACE_DAYS}
        working={deleteWorking}
        error={deleteError}
        onConfirm={(password) => void handleDeleteAccount(password)}
        onClose={() => setDeleteVisible(false)}
      />
    </DetailContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: { alignItems: 'center', marginBottom: 20, gap: 8 },
    name: { fontSize: 22, fontWeight: 'bold', color: colors.text, textAlign: 'center' },
    url: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
    ageLine: { fontSize: 14, color: colors.text, textAlign: 'center', marginBottom: 16 },
    ...serverCardStyleDefs(colors),
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
    tagText: { ...typography.label, color: colors.primary },
    sectionTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      color: colors.textSecondary,
      marginBottom: 8,
    },
  });

export default ServerDetailScreen;
