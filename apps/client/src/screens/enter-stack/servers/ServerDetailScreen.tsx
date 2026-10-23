import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import Avatar from '@/src/components/common/display/Avatar/Avatar';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { Ionicons } from '@expo/vector-icons';
import { type RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DeleteAccountModal from '@/src/components/features/servers/DeleteAccountModal/DeleteAccountModal';
import PlanLimitsCard from '@/src/components/features/servers/PlanLimitsCard';
import PlanStatusCard from '@/src/components/features/servers/PlanStatusCard';
import ServerActionRow from '@/src/components/features/servers/ServerActionRow';
import ServerShowcaseAction from '@/src/components/features/servers/ServerShowcaseAction';
import TermsModal from '@/src/components/features/servers/TermsModal/TermsModal';
import { serverCardStyleDefs } from '@/src/components/features/servers/serverCardStyleDefs';
import ServerStatusPill from '@/src/components/features/servers/ServerStatusPill';
import StoryUsageCard from '@/src/components/features/servers/StoryUsageCard';
import { useDrizzle } from '@/src/db';
import { useAccountPlan } from '@/src/screens/enter-stack/servers/useAccountPlan';
import { useServerStoryUsage } from '@/src/screens/enter-stack/servers/useServerStoryUsage';
import {
  accountAgeStatusKey,
  useAccountVerificationNotice,
} from '@/src/screens/enter-stack/servers/useAccountVerificationNotice';
import { useAgeVerificationInfo } from '@/src/screens/enter-stack/servers/useAgeVerificationInfo';
import { formatDateTime } from '@/src/utils/format/formatDateTime';
import { usePaymentOverview } from '@/src/screens/enter-stack/servers/usePaymentOverview';
import { useServerDeletion } from '@/src/screens/enter-stack/servers/useServerDeletion';
import { useLiveServerLegalTexts } from '@/src/screens/enter-stack/servers/useLiveLegalText';
import { useServerStatuses } from '@/src/screens/enter-stack/servers/useServerStatuses';
import { useStableServer } from '@/src/screens/enter-stack/servers/useStableServer';
import { useServerTagEditor } from '@/src/screens/enter-stack/servers/useServerTagEditor';
import type { ServerManagementStackParamList } from '@/src/navigation/stacks/StorySelectionStack';
import { ACCOUNT_DELETION_GRACE_DAYS } from '@keres/shared';
import { exportAccountData } from '@/src/services/account/AccountDataExportService';
import { createServerService } from '@/src/services/servers/ServerService';
import {
  acceptLegal,
  fetchLegalStatus,
  fetchServerPrivacy,
  fetchServerTerms,
  type ServerTerms,
} from '@/src/services/servers/ServerTermsService';
import {
  AccountDeletionCleanupError,
  deleteServerAccount,
} from '@/src/services/account/DeleteAccountService';
import { isOfflineError } from '@/src/services/api/apiClient';
import { useIsConversationUnseen } from '@/src/state/ui/unseenMessagesStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { userApiService } from '@/src/services/api/UserApiService';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { type ThemeColors, useTheme } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { typography } from '@/src/theme/tokens';
import { adminConversationKey } from '@/src/utils/entity/conversationKey';
import { serverDisplayName } from '@/src/utils/auth/defaultServer';

type ServerDetailRouteProp = RouteProp<ServerManagementStackParamList, 'ServerDetail'>;
type ServerDetailNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'ServerDetail'
>;

interface OwnProfile {
  avatarColor: string | null;
  avatarIcon: string | null;
  isAdultVerified?: boolean;
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
  // What the network hooks and effects below depend on: it changes when the server does, not on every re-read.
  const stableServer = useStableServer(server);
  const [termsVisible, setTermsVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  // The saved texts keep the language of the day they were saved: while one is open, the same version is read again
  // in the language the app has now.
  const { liveTerms, livePrivacy } = useLiveServerLegalTexts(server, i18n.language, {
    terms: termsVisible,
    privacy: privacyVisible,
  });
  const [profile, setProfile] = useState<OwnProfile | null>(null);

  useScreenHeader({
    target: 'parent',
    title: server ? serverDisplayName(server, t) : t('server_detail_title'),
  });

  const tagEditor = useServerTagEditor(server, serverService, updateTag);
  const deleteServer = useServerDeletion(serverService, () => navigation.goBack());

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
    if (!stableServer || !online || profile) return;
    let cancelled = false;
    userApiService
      .getOwnProfile(stableServer)
      .then((own) => {
        if (!cancelled && own) setProfile(own);
      })
      .catch(() => {
        // The avatar is a nicety: without it the generated one stays.
      });
    return () => {
      cancelled = true;
    };
  }, [stableServer, online, profile]);

  // The documents move under the account: when the server serves a newer text than the account
  // accepted (or the account predates acceptance records entirely), the fresh text is fetched
  // and the update row below asks for agreement. Offline or predated servers simply skip this.
  useEffect(() => {
    if (!stableServer || !online || legalUpdate || acceptWorking) return;
    let cancelled = false;
    void (async () => {
      const status = await fetchLegalStatus(stableServer);
      if (cancelled || !status) return;
      const laggingKind =
        status.tos.accepted === null || status.tos.accepted < status.tos.current
          ? ('tos' as const)
          : status.privacy.accepted === null || status.privacy.accepted < status.privacy.current
            ? ('privacy' as const)
            : null;
      if (!laggingKind) {
        // Signing in to an account made elsewhere never went through this device's terms and privacy steps, so the
        // texts were never kept here and the rows below would not exist. The account is up to date with the current
        // texts (that is what "not lagging" says), so these are the ones it accepted: keep them to read offline.
        const patch: Record<string, string> = {};
        if (!stableServer.tosText) {
          const terms = await fetchServerTerms(stableServer.url, i18n.language);
          if (terms)
            Object.assign(patch, { tosText: terms.text, tosVersion: String(terms.version) });
        }
        if (!stableServer.privacyText) {
          const privacy = await fetchServerPrivacy(stableServer.url, i18n.language);
          if (privacy) {
            Object.assign(patch, {
              privacyText: privacy.text,
              privacyVersion: String(privacy.version),
            });
          }
        }
        if (!cancelled && Object.keys(patch).length > 0) {
          await serverService.updateServer(stableServer.id, patch);
        }
        return;
      }
      const fresh =
        laggingKind === 'tos'
          ? await fetchServerTerms(stableServer.url, i18n.language)
          : await fetchServerPrivacy(stableServer.url, i18n.language);
      if (cancelled || !fresh) return;
      setLegalUpdate({ kind: laggingKind, ...fresh });
    })();
    return () => {
      cancelled = true;
    };
  }, [stableServer, online, legalUpdate, acceptWorking, i18n.language, serverService]);

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
  const { overview: payments } = usePaymentOverview(stableServer, online);
  // The plan the person has - the free one included - and what it comes with, whether or not the server sells any.
  const { plan } = useAccountPlan(stableServer, online);
  // Whether this server checks ages, said in one line while it answers. A server with no check must never look verified.
  const ageInfo = useAgeVerificationInfo(online ? server?.url : undefined, online);
  // An account still waiting for (or refused in) its age check is sent back to it from here. Asked again when the
  // screen comes back to the front, because the approval may have happened on the verification screen.
  const focused = useIsFocused();
  const verificationNotice = useAccountVerificationNotice(stableServer, online && focused);
  const ageStatus = accountAgeStatusKey(profile?.isAdultVerified, verificationNotice);
  // The person's own stories here and how full each is, read again whenever the screen comes back to the front.
  const { stories: storyUsage } = useServerStoryUsage(serverId, focused);

  const hasUnseenAdminMessage = useIsConversationUnseen(adminConversationKey(serverId));

  const openMessages = () => {
    navigation.navigate('Conversation', { serverId, peer: 'admin' });
  };

  const styles = useThemedStyles(createStyles);

  /** "Terms v3 · 13/10/2026": the day the account accepted it, else the day the text is dated, else just the version. */
  const legalSubtitle = (
    key: 'server_terms_version' | 'server_privacy_version',
    version: string | null | undefined,
    acceptedAt: Date | null | undefined,
    dated: string | undefined,
  ) => {
    const date = acceptedAt != null ? formatDateTime(acceptedAt, i18n.language) : (dated ?? '');
    return date
      ? t(key, { version: version ?? '', date })
      : t(`${key}_plain`, { version: version ?? '' });
  };

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
        <Text style={styles.name}>{serverDisplayName(server, t)}</Text>
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
        {ageStatus ? field(t('server_age_status_field'), t(ageStatus)) : null}
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
            : t('age_verification_line_manual')}
        </Text>
      ) : null}

      {plan || payments?.info.subscription ? (
        <>
          <Text style={styles.sectionTitle}>{t('server_plan_section')}</Text>
          {plan ? <PlanLimitsCard plan={plan} /> : null}
          {plan && storyUsage.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>{t('plan_card_story_usage_title')}</Text>
              <StoryUsageCard stories={storyUsage} limit={plan.maxEntitiesPerStory} />
            </>
          ) : null}
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
        badgeLabel={t('messages_unseen_admin_on', { server: serverDisplayName(server, t) })}
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
        icon="newspaper-outline"
        title={t('server_action_author_page')}
        description={t('server_action_author_page_hint')}
        onPress={() => navigation.navigate('PublicProfile', { serverId })}
        testID="server-action-author-page"
      />
      <ServerShowcaseAction serverId={serverId} />
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
        icon="create-outline"
        title={t('server_action_connection')}
        description={t('server_action_connection_hint')}
        onPress={() => navigation.navigate('ServerRegistration', { serverId })}
        testID="server-action-connection"
      />
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
          subtitle={legalSubtitle(
            'server_terms_version',
            server.tosVersion,
            server.tosAcceptedAt,
            liveTerms?.updatedAt,
          )}
          sections={
            liveTerms?.sections ?? [
              { heading: t('server_terms_title'), paragraphs: [server.tosText] },
            ]
          }
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
          subtitle={legalSubtitle(
            'server_privacy_version',
            server.privacyVersion,
            server.privacyAcceptedAt,
            livePrivacy?.updatedAt,
          )}
          sections={
            livePrivacy?.sections ?? [
              { heading: t('server_privacy_title'), paragraphs: [server.privacyText] },
            ]
          }
          mode="read"
          onClose={() => setPrivacyVisible(false)}
          testID="server-privacy-modal"
        />
      ) : null}
      <DeleteAccountModal
        visible={deleteVisible}
        serverName={serverDisplayName(server, t)}
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
