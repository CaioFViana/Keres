import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import ServerRecoveryCodesPanel from '@/src/components/features/servers/ServerRecoveryCodesPanel';
import ServerRegistrationFields, {
  type ServerAuthMode,
} from '@/src/components/features/servers/ServerRegistrationFields';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useNavigation, useRoute } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useDrizzle } from '../../db';
import { redeemRecoveryCode } from '../../services/AuthApiService';
import { authTokenManager } from '../../services/AuthTokenManager';
import { hostedApiOrigin, usesHttpOnlyCookieSession } from '../../services/browserCookieSession';
import {
  createServerService,
  ServerHasOwnedStoriesError,
  ServerUrlAlreadyRegisteredError,
} from '../../services/ServerService';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { authenticateWithKeresServer, keresAuthAlertMessage } from '../../utils/keresServerAuth';
import { normalizeServerUrl } from '../../utils/serverUrl';

type RootStackParamList = {
  ServerRegistration: { serverId?: string };
  ServerManagement: undefined;
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
  const { t } = useTranslation();
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
  const serverService = useRef(createServerService(drizzleDb)).current;
  const { setActiveServer } = useUserSettingsStore();

  const [mode, setMode] = useState<ServerAuthMode>('login');
  const [serverAddress, setServerAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [serverName, setServerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recoveryCodesToShow, setRecoveryCodesToShow] = useState<string[] | null>(null);

  const hostedSameOrigin = usesHttpOnlyCookieSession();
  const lockedServerAddress = hostedSameOrigin ? hostedApiOrigin() : null;

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
        : await serverService.createServer({ ...serverData, lastSyncDate: new Date() });
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
        setActiveServer(savedServer);
        entityEventEmitter.emit('server_connection_changed');
      }
      if (auth.recoveryCodes) {
        setRecoveryCodesToShow(auth.recoveryCodes);
      } else {
        navigation.goBack();
      }
    } catch (err) {
      const errorMessage =
        err instanceof ServerUrlAlreadyRegisteredError
          ? t('server_url_already_registered')
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
    serverName,
    serverService,
    navigation,
    t,
    serverId,
    mode,
    setActiveServer,
  ]);

  const handleRecover = useCallback(async () => {
    const addressToSave = (lockedServerAddress ?? serverAddress).trim();
    if (!addressToSave || !username.trim() || !recoveryCode.trim()) {
      AppAlert.alert(t('error'), t('all_fields_required_except_password_for_edit'));
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
          navigation.goBack();
        }}
      />
    );
  }

  return (
    <EntityFormContainer
      title={serverId ? t('edit_server') : t('register_new_server')}
      description={serverId ? t('edit_server_description') : t('register_new_server_description')}
      actions={
        serverId ? (
          <FormActions stackOnCompact>
            <Button onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : t('update_server')}
            </Button>
            <Button
              onPress={handleDeleteServer}
              style={{ backgroundColor: colors.error }}
              disabled={loading}
            >
              {t('delete_server')}
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
      {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}
    </EntityFormContainer>
  );
};

const styles = StyleSheet.create({
  errorText: { marginTop: 10, textAlign: 'center' },
});

export default ServerRegistrationScreen;
