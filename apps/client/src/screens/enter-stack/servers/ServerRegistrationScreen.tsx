import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import AgeVerificationNotice from '@/src/components/features/servers/AgeVerificationNotice';
import ServerRecoveryCodesPanel from '@/src/components/features/servers/ServerRecoveryCodesPanel';
import ServerRegistrationFields, {
  type ServerAuthMode,
} from '@/src/components/features/servers/ServerRegistrationFields';
import TermsModal, {
  type TermsSection,
} from '@/src/components/features/servers/TermsModal/TermsModal';
import { useAgeVerificationInfo } from '@/src/screens/enter-stack/servers/useAgeVerificationInfo';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useDebouncedValue } from '@/src/hooks/ui/useDebouncedValue';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useDrizzle } from '@/src/db';
import { redeemRecoveryCode } from '@/src/services/api/AuthApiService';
import { authTokenManager } from '@/src/services/auth/AuthTokenManager';
import { fetchAgeVerificationInfo } from '@/src/services/api/AgeVerificationApiService';
import {
  hostedApiOrigin,
  usesHttpOnlyCookieSession,
} from '@/src/services/auth/browserCookieSession';
import {
  createServerService,
  ServerHasOwnedStoriesError,
  ServerUrlAlreadyRegisteredError,
  ServerUrlNotSecureError,
} from '@/src/services/servers/ServerService';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { useTheme } from '@/src/theme';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { entityEventEmitter } from '@/src/state/events/EventEmitter';
import {
  authenticateWithKeresServer,
  keresAuthAlertMessage,
} from '@/src/services/auth/keresServerAuth';
import { accountNeedsVerification } from '@/src/services/auth/ageVerificationRouting';
import { blocksNewAccounts } from '@/src/utils/auth/ageVerificationRules';
import { fetchServerPrivacy, fetchServerTerms } from '@/src/services/servers/ServerTermsService';
import { isAllowedServerUrl, normalizeServerUrl } from '@/src/utils/auth/serverUrl';

type RootStackParamList = {
  ServerRegistration: { serverId?: string };
  ServerManagement: undefined;
  ServerVerification: { serverId: string };
};

type ServerRegistrationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ServerRegistration'
>;

/** Matches ChangePasswordScreen's own constant - the server doesn't enforce a minimum on
 *  /auth/register today, this is purely client-side UX guidance. */
const MIN_PASSWORD_LENGTH = 8;

const ServerRegistrationScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ServerRegistrationScreenNavigationProp>();
  const route =
    useRoute<NativeStackScreenProps<RootStackParamList, 'ServerRegistration'>['route']>();
  const { serverId } = route.params || {};
  useScreenHeader({
    target: 'parent',
    title: serverId ? t('edit_server') : t('register_new_server'),
  });

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const [serverService] = useState(() => createServerService(drizzleDb));
  const { setActiveServer } = useUserSettingsStore();

  const [mode, setMode] = useState<ServerAuthMode>('login');
  const [serverAddress, setServerAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [serverName, setServerName] = useState('');
  // Accounts are 18+: confirmed on the form before the terms gate, which is about the server.
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodesToShow, setRecoveryCodesToShow] = useState<string[] | null>(null);
  // Set when the account must be verified first: the recovery codes panel leads there, not back.
  const [verificationServerId, setVerificationServerId] = useState<string | null>(null);
  // Creating an account needs the server's terms first: offered once agreed, the agreed copy
  // travels into the saved server row so it reads offline later. A ref, not state: the agree
  // button continues straight into saving, and state would still read stale in that same tick.
  const [pendingTerms, setPendingTerms] = useState<{
    version: number;
    updatedAt: string;
    sections: TermsSection[];
    text: string;
  } | null>(null);
  const agreedTermsRef = useRef<{ version: number; text: string } | null>(null);
  // The privacy policy gates the same way, right after the terms: same shape, second modal.
  const [pendingPrivacy, setPendingPrivacy] = useState<{
    version: number;
    updatedAt: string;
    sections: TermsSection[];
    text: string;
  } | null>(null);
  const agreedPrivacyRef = useRef<{ version: number; text: string } | null>(null);

  const hostedSameOrigin = usesHttpOnlyCookieSession();
  const lockedServerAddress = hostedSameOrigin ? hostedApiOrigin() : null;

  // What the server says about age, read once the address stops changing: it sits beside the 18+ confirmation.
  const checkedAddress = useDebouncedValue((lockedServerAddress ?? serverAddress).trim(), 500);
  const ageInfo = useAgeVerificationInfo(
    isAllowedServerUrl(checkedAddress) ? checkedAddress : undefined,
    !serverId && mode === 'register',
  );

  useEffect(() => {
    const loadServer = async () => {
      if (serverId) {
        try {
          setLoading(true);
          const fetchedServer = await serverService.getServerById(serverId);
          if (fetchedServer) {
            setServerAddress(lockedServerAddress ?? fetchedServer.url);
            setUsername(fetchedServer.userName);
            setServerName(fetchedServer.name || '');
          } else {
            setError(t('server_not_found'));
          }
        } catch (err) {
          console.error('Failed to load server:', err);
          setError(t('failed_to_load_server'));
        } finally {
          setLoading(false);
        }
      } else {
        if (lockedServerAddress) setServerAddress(lockedServerAddress);
        setLoading(false);
      }
    };
    void loadServer();
  }, [serverId, serverService, t, lockedServerAddress]);

  const handleSave = useCallback(async () => {
    const addressToSave = (lockedServerAddress ?? serverAddress).trim();
    if (!addressToSave || !username.trim()) {
      AppAlert.alert(t('error'), t('all_fields_required_except_password_for_edit'));
      return;
    }
    if (!isAllowedServerUrl(addressToSave)) {
      AppAlert.alert(t('error'), t('server_url_must_be_https'));
      return;
    }
    if (!serverId && !password.trim()) {
      AppAlert.alert(t('error'), t('password_required_for_registration'));
      return;
    }
    if (!serverId) {
      const duplicateServer = await serverService.getServerByUrl(addressToSave);
      if (duplicateServer) {
        AppAlert.alert(t('error'), t('server_url_already_registered'));
        return;
      }
    }
    if (!serverId && mode === 'register') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        AppAlert.alert(t('error'), t('new_password_too_short'));
        return;
      }
      if (password !== confirmPassword) {
        AppAlert.alert(t('error'), t('passwords_do_not_match'));
        return;
      }
      if (!adultConfirmed) {
        AppAlert.alert(t('error'), t('server_register_adult_required'));
        return;
      }
      // The account is only created under the server's own terms and privacy policy: read
      // them right after the address checked out, and pause for agreement before anything is
      // written anywhere. A server predating either route simply has none to agree to.
      setLoading(true);
      // A server that verifies ages but cannot right now creates no account at all: said before anything is sent.
      if (blocksNewAccounts(await fetchAgeVerificationInfo(addressToSave))) {
        const message = t('age_verification_unavailable');
        setLoading(false);
        setError(message);
        AppAlert.alert(t('error'), message);
        return;
      }
      const terms = await fetchServerTerms(addressToSave, i18n.language);
      if (terms && agreedTermsRef.current?.version !== terms.version) {
        setPendingTerms(terms);
        setLoading(false);
        return;
      }
      const privacy = await fetchServerPrivacy(addressToSave, i18n.language);
      if (privacy && agreedPrivacyRef.current?.version !== privacy.version) {
        setPendingPrivacy(privacy);
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    setLoading(true);
    setError(null);

    let existingServer = null;
    if (serverId) {
      existingServer = await serverService.getServerById(serverId);
      if (!existingServer) {
        setError(t('server_not_found'));
        setLoading(false);
        return;
      }
      if (normalizeServerUrl(existingServer.url) !== normalizeServerUrl(addressToSave)) {
        const duplicateServer = await serverService.getServerByUrl(addressToSave);
        if (duplicateServer && duplicateServer.id !== serverId) {
          AppAlert.alert(t('error'), t('server_url_already_registered'));
          setLoading(false);
          return;
        }
      }
    }

    const existingTokens = existingServer
      ? await authTokenManager.getTokens(existingServer.id)
      : null;
    const isNewServer = !serverId;
    const isPasswordProvided = password.trim().length > 0;
    const isUrlChanged = !!(existingServer && existingServer.url !== addressToSave);
    const isRegistering = isNewServer && mode === 'register';

    try {
      const auth = await authenticateWithKeresServer({
        address: addressToSave,
        username,
        password,
        isRegistering,
        needsAuth: isNewServer || isPasswordProvided || isUrlChanged,
        urlChangedWithoutPassword: isUrlChanged && !isPasswordProvided,
        existingUserId: existingServer?.idUser || null,
        existingTag: existingServer?.tag ?? null,
        language: i18n.language,
      });
      if (!auth.ok) {
        AppAlert.alert(t('error'), keresAuthAlertMessage(t, auth));
        setLoading(false);
        return;
      }

      const serverData = {
        idUser: auth.userId,
        userName: username,
        tag: auth.tag,
        name: serverName || addressToSave,
        url: addressToSave,
      };

      const savedServer = serverId
        ? await serverService
            .updateServer(serverId, serverData)
            .then(() => serverService.getServerById(serverId))
        : await serverService.createServer({
            ...serverData,
            lastSyncDate: new Date(),
            // The agreed copies, if the server served terms and policy: they read offline
            // from here on.
            ...(agreedTermsRef.current
              ? {
                  tosText: agreedTermsRef.current.text,
                  tosVersion: String(agreedTermsRef.current.version),
                  tosAcceptedAt: new Date(),
                }
              : {}),
            ...(agreedPrivacyRef.current
              ? {
                  privacyText: agreedPrivacyRef.current.text,
                  privacyVersion: String(agreedPrivacyRef.current.version),
                  privacyAcceptedAt: new Date(),
                }
              : {}),
          });
      AppAlert.alert(
        t('success'),
        serverId ? t('server_updated_successfully') : t('server_registered_successfully'),
      );

      if (savedServer) {
        if (auth.tokensChanged) {
          await authTokenManager.updateTokens(savedServer.id, auth.accessToken, auth.refreshToken);
        } else if (existingTokens) {
          await authTokenManager.updateTokens(
            savedServer.id,
            existingTokens.accessToken,
            existingTokens.refreshToken,
          );
        }
      }
      // A pending account is not used yet: its session only opens the verification, so the server is not made the
      // active one (sync would only be refused) until the verification hands over the full session.
      const verifyFirst = savedServer
        ? await accountNeedsVerification(savedServer, auth, isRegistering)
        : false;
      if (savedServer) {
        if (!verifyFirst) setActiveServer(savedServer);
        entityEventEmitter.emit('server_connection_changed');
      }
      if (savedServer && verifyFirst) setVerificationServerId(savedServer.id);
      if (auth.recoveryCodes) {
        setRecoveryCodesToShow(auth.recoveryCodes);
      } else if (savedServer && verifyFirst) {
        navigation.replace('ServerVerification', { serverId: savedServer.id });
      } else {
        navigation.goBack();
      }
    } catch (err) {
      const errorMessage =
        err instanceof ServerUrlAlreadyRegisteredError
          ? t('server_url_already_registered')
          : err instanceof ServerUrlNotSecureError
            ? t('server_url_must_be_https')
            : err instanceof Error
              ? err.message
              : t('failed_to_save_server');
      setError(errorMessage);
      AppAlert.alert(t('error'), errorMessage);
    } finally {
      setLoading(false);
    }
  }, [
    serverAddress,
    lockedServerAddress,
    username,
    password,
    confirmPassword,
    adultConfirmed,
    serverName,
    serverService,
    navigation,
    t,
    serverId,
    mode,
    setActiveServer,
    i18n.language,
  ]);

  const handleAgreeTerms = useCallback(() => {
    if (!pendingTerms) return;
    agreedTermsRef.current = { version: pendingTerms.version, text: pendingTerms.text };
    setPendingTerms(null);
    // Continue straight into registration: the gate above now reads the agreement from the ref.
    void handleSave();
  }, [pendingTerms, handleSave]);

  const handleAgreePrivacy = useCallback(() => {
    if (!pendingPrivacy) return;
    agreedPrivacyRef.current = { version: pendingPrivacy.version, text: pendingPrivacy.text };
    setPendingPrivacy(null);
    // Same as the terms: the gate above now reads the agreement from the ref.
    void handleSave();
  }, [pendingPrivacy, handleSave]);

  const handleRecover = useCallback(async () => {
    const addressToSave = (lockedServerAddress ?? serverAddress).trim();
    if (!addressToSave || !username.trim() || !recoveryCode.trim()) {
      AppAlert.alert(t('error'), t('all_fields_required_except_password_for_edit'));
      return;
    }
    if (!isAllowedServerUrl(addressToSave)) {
      AppAlert.alert(t('error'), t('server_url_must_be_https'));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      AppAlert.alert(t('error'), t('new_password_too_short'));
      return;
    }
    if (password !== confirmPassword) {
      AppAlert.alert(t('error'), t('passwords_do_not_match'));
      return;
    }
    const duplicateServer = await serverService.getServerByUrl(addressToSave);
    if (duplicateServer) {
      AppAlert.alert(t('error'), t('server_url_already_registered'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const outcome = await redeemRecoveryCode(addressToSave, username, recoveryCode, password);
      if (!outcome.success) {
        AppAlert.alert(
          t('error'),
          outcome.reason === 'invalid_code'
            ? t('recovery_code_invalid')
            : outcome.reason === 'rate_limited'
              ? t('recovery_code_rate_limited')
              : `${t('server_error')}: ${outcome.status}`,
        );
        setLoading(false);
        return;
      }
      const savedServer = await serverService.createServer({
        idUser: outcome.result.userId,
        userName: username,
        tag: outcome.result.tag,
        name: serverName || addressToSave,
        url: addressToSave,
        lastSyncDate: new Date(),
      });
      await authTokenManager.updateTokens(
        savedServer.id,
        outcome.result.accessToken,
        outcome.result.refreshToken,
      );
      setActiveServer(savedServer);
      entityEventEmitter.emit('server_connection_changed');
      AppAlert.alert(t('success'), t('password_reset_successfully'));
      navigation.goBack();
    } catch (err) {
      const errorMessage =
        err instanceof ServerUrlAlreadyRegisteredError
          ? t('server_url_already_registered')
          : err instanceof ServerUrlNotSecureError
            ? t('server_url_must_be_https')
            : err instanceof Error
              ? err.message
              : t('failed_to_save_server');
      setError(errorMessage);
      AppAlert.alert(t('error'), errorMessage);
    } finally {
      setLoading(false);
    }
  }, [
    serverAddress,
    lockedServerAddress,
    username,
    recoveryCode,
    password,
    confirmPassword,
    serverName,
    serverService,
    navigation,
    t,
    setActiveServer,
  ]);

  const handleDeleteServer = useCallback(() => {
    AppAlert.alert(t('delete_server_title'), t('delete_server_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          if (!serverId) return;
          try {
            setLoading(true);
            await serverService.deleteServer(serverId);
            AppAlert.alert(t('success'), t('server_deleted_successfully'));
            navigation.goBack();
          } catch (err) {
            console.error('Failed to delete server:', err);
            if (err instanceof ServerHasOwnedStoriesError) {
              const message = t('cannot_delete_server_owned_stories_message', {
                stories: err.ownedStories.map((story) => story.title).join(', '),
              });
              setError(message);
              AppAlert.alert(t('cannot_delete_server_owned_stories_title'), message);
            } else {
              setError(t('failed_to_delete_server'));
              AppAlert.alert(t('error'), t('failed_to_delete_server'));
            }
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }, [serverId, serverService, navigation, t]);

  if (loading) return <ScreenLoading message={t('loading_server_data')} />;
  if (error && serverId) {
    return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (recoveryCodesToShow) {
    return (
      <ServerRecoveryCodesPanel
        codes={recoveryCodesToShow}
        onContinue={() => {
          setRecoveryCodesToShow(null);
          if (verificationServerId) {
            navigation.replace('ServerVerification', { serverId: verificationServerId });
          } else {
            navigation.goBack();
          }
        }}
      />
    );
  }

  return (
    <EntityFormContainer
      planUsage={false}
      title={serverId ? t('edit_server') : t('register_new_server')}
      description={serverId ? t('edit_server_description') : t('register_new_server_description')}
      actions={
        serverId ? (
          <FormActions stackOnCompact>
            <Button onPress={handleDeleteServer} variant="destructive" disabled={loading}>
              {t('delete_server')}
            </Button>
            <Button onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : t('update_server')}
            </Button>
          </FormActions>
        ) : (
          <Button onPress={mode === 'recover' ? handleRecover : handleSave} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : mode === 'recover' ? (
              t('reset_password_button')
            ) : mode === 'register' ? (
              t('create_account')
            ) : (
              t('register_server')
            )}
          </Button>
        )
      }
    >
      <ServerRegistrationFields
        serverId={serverId}
        mode={mode}
        onModeChange={setMode}
        hostedSameOrigin={hostedSameOrigin}
        serverAddress={serverAddress}
        onServerAddressChange={setServerAddress}
        serverName={serverName}
        onServerNameChange={setServerName}
        username={username}
        onUsernameChange={setUsername}
        password={password}
        onPasswordChange={setPassword}
        confirmPassword={confirmPassword}
        onConfirmPasswordChange={setConfirmPassword}
        recoveryCode={recoveryCode}
        onRecoveryCodeChange={setRecoveryCode}
        inputStyle={commonInputStyles.input}
      />
      {!serverId && mode === 'register' ? (
        <>
          <FormSwitchField
            label={t('server_register_adult_confirm')}
            value={adultConfirmed}
            onValueChange={setAdultConfirmed}
            testID="server-register-adult-switch"
          />
          <AgeVerificationNotice info={ageInfo} testID="server-age-verification-notice" />
        </>
      ) : null}
      {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
      <TermsModal
        visible={pendingTerms !== null}
        title={t('server_terms_title')}
        subtitle={
          pendingTerms
            ? t('server_terms_version', {
                version: pendingTerms.version,
                date: pendingTerms.updatedAt,
              })
            : undefined
        }
        sections={pendingTerms?.sections ?? []}
        mode="accept"
        acceptLabel={t('terms_accept')}
        onAccept={handleAgreeTerms}
        onClose={() => setPendingTerms(null)}
        requireScrollToEnd
        testID="server-terms-modal"
      />
      <TermsModal
        visible={pendingPrivacy !== null}
        title={t('server_privacy_title')}
        subtitle={
          pendingPrivacy
            ? t('server_privacy_version', {
                version: pendingPrivacy.version,
                date: pendingPrivacy.updatedAt,
              })
            : undefined
        }
        sections={pendingPrivacy?.sections ?? []}
        mode="accept"
        acceptLabel={t('terms_accept')}
        onAccept={handleAgreePrivacy}
        onClose={() => setPendingPrivacy(null)}
        requireScrollToEnd
        testID="server-privacy-modal"
      />
    </EntityFormContainer>
  );
};

const styles = StyleSheet.create({
  errorText: { marginTop: 10, textAlign: 'center' },
});

export default ServerRegistrationScreen;
