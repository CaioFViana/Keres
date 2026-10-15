import Button from '@/src/components/common/controls/Button/Button';
import DetailContainer from '@/src/components/layout/DetailContainer/DetailContainer';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import { useServerStatuses } from '@/src/screens/enter-stack/servers/useServerStatuses';
import {
  useServerVerification,
  type VerificationRetryError,
} from '@/src/screens/enter-stack/servers/useServerVerification';
import type { AccountVerificationResponse } from '@keres/shared';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import type { ServerManagementStackParamList } from '@/src/navigation/stacks/StorySelectionStack';
import { isOpenableVerificationUrl } from '@/src/utils/auth/ageVerificationRules';
import { type ThemeColors, useTheme } from '@/src/theme';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type ServerVerificationRouteProp = RouteProp<ServerManagementStackParamList, 'ServerVerification'>;
type ServerVerificationNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'ServerVerification'
>;

const RETRY_ERROR_KEYS: Record<VerificationRetryError, string> = {
  conflict: 'verification_retry_conflict',
  unavailable: 'verification_service_unavailable',
  failed: 'verification_retry_failed',
};

/** The reason a refusal is shown with; an expiry has none, and a refusal without one reads as "other". */
function reasonKey(answer: AccountVerificationResponse): string {
  if (answer.reason) return `verification_reason_${answer.reason}`;
  return answer.status === 'expired' ? 'verification_reason_expired' : 'verification_reason_other';
}

/**
 * The age check of a pending account, on this server. The person sends the documents to the verification service the
 * server names (the page is opened, nothing is typed here); the app only shows where it stands, and asks again until
 * the answer comes. Nothing about the documents ever passes through the app: it stores the session when it is approved,
 * and nothing else.
 */
const ServerVerificationScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ServerVerificationNavigationProp>();
  const { serverId } = useRoute<ServerVerificationRouteProp>().params;
  const { servers, loading, error } = useServerStatuses(serverId);
  const server = servers[0];
  const { answer, loadFailed, retrying, retryError, retry, sessionStored } =
    useServerVerification(server);
  const [openFailed, setOpenFailed] = useState(false);
  const styles = useThemedStyles(createStyles);

  useScreenHeader({ target: 'parent', title: t('age_verification_title') });

  // The session is stored: leave the way a successful login leaves (back to where the account was started from).
  useEffect(() => {
    if (sessionStored) navigation.goBack();
  }, [sessionStored, navigation]);

  const openPage = async (url: string) => {
    setOpenFailed(false);
    try {
      await Linking.openURL(url);
    } catch {
      setOpenFailed(true);
    }
  };

  const backToServers = () => (
    <Button
      onPress={() => navigation.navigate('ServerManagement')}
      style={styles.secondary}
      testID="verification-back"
    >
      {t('verification_back_to_servers')}
    </Button>
  );

  if (loading && !server) return <ScreenLoading message={t('loading_servers')} />;
  if (error || !server) {
    return (
      <ScreenError message={error ?? t('server_not_found')} onGoBack={() => navigation.goBack()} />
    );
  }

  const action = answer?.action;
  const refused = answer?.status === 'rejected' || answer?.status === 'expired';

  return (
    <DetailContainer>
      {!answer ? (
        loadFailed ? (
          <Text style={styles.hint} testID="verification-load-failed">
            {t('verification_load_failed')}
          </Text>
        ) : (
          <View style={styles.waiting}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.hint}>{t('verification_loading')}</Text>
          </View>
        )
      ) : null}

      {answer?.status === 'pending' ? (
        <>
          <Text style={styles.text} testID="verification-explain">
            {t('verification_explain_send')}
          </Text>
          <Text style={styles.text}>{t('verification_explain_reader')}</Text>
          <Text style={styles.text}>{t('verification_explain_destroyed')}</Text>
          {action?.kind === 'redirect' ? (
            isOpenableVerificationUrl(action.url) ? (
              <Button onPress={() => void openPage(action.url)} testID="verification-open">
                {t('verification_open_page')}
              </Button>
            ) : (
              <Text style={styles.error} testID="verification-link-refused">
                {t('verification_link_refused')}
              </Text>
            )
          ) : null}
          {action?.kind === 'instructions' ? (
            <View style={styles.panel} testID="verification-instructions">
              <Text style={styles.subtitle}>{action.title}</Text>
              <Text style={styles.text} selectable>
                {action.text}
              </Text>
            </View>
          ) : null}
          {openFailed ? <Text style={styles.error}>{t('verification_open_failed')}</Text> : null}
          <View style={styles.waiting}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.hint}>{t('verification_waiting')}</Text>
          </View>
        </>
      ) : null}

      {answer && refused ? (
        <>
          <Text style={[styles.title, styles.bad]} testID="verification-refused">
            {t(
              answer.status === 'expired'
                ? 'verification_expired_title'
                : 'verification_rejected_title',
            )}
          </Text>
          <Text style={styles.text} testID="verification-reason">
            {t(reasonKey(answer))}
          </Text>
          {answer.canRetry ? (
            <Button onPress={() => void retry()} disabled={retrying} testID="verification-retry">
              {retrying ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                t('verification_send_again')
              )}
            </Button>
          ) : (
            <>
              <Text style={styles.text} testID="verification-closed">
                {t(
                  answer.reason === 'underage'
                    ? 'verification_closed_underage'
                    : 'verification_closed',
                )}
              </Text>
              {backToServers()}
            </>
          )}
          {retryError ? (
            <Text style={styles.error} testID="verification-retry-error">
              {t(RETRY_ERROR_KEYS[retryError])}
            </Text>
          ) : null}
        </>
      ) : null}

      {answer?.status === 'approved' ? (
        <View style={styles.waiting} testID="verification-finishing">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.hint}>{t('verification_finishing')}</Text>
        </View>
      ) : null}

      {answer?.status === 'not_required' ? (
        <>
          <Text style={styles.text} testID="verification-not-required">
            {t('verification_not_required')}
          </Text>
          {backToServers()}
        </>
      ) : null}
    </DetailContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    title: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
    subtitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    text: { fontSize: 14, color: colors.text, marginBottom: 12 },
    hint: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
    error: { fontSize: 14, color: colors.error, marginTop: 8 },
    bad: { color: colors.error },
    panel: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      backgroundColor: colors.card,
      padding: 16,
      gap: 12,
      marginBottom: 16,
    },
    waiting: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    secondary: { backgroundColor: colors.border },
  });

export default ServerVerificationScreen;
