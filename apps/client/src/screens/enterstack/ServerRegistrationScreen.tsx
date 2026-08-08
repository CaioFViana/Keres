import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import { useDrizzle } from '../../db';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import apiClient from '../../services/apiClient';
import { createServerService } from '../../services/ServerService';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

type RootStackParamList = {
  ServerRegistration: { serverId?: string };
  ServerManagement: undefined;
};

type ServerRegistrationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ServerRegistration'>;

/** Matches ChangePasswordScreen's own constant - the server doesn't enforce a minimum on
 *  /auth/register today, this is purely client-side UX guidance. */
const MIN_PASSWORD_LENGTH = 8;

const ServerRegistrationScreen = () => {
    useBackButtonHandler({ showWebBackButton: true })
    const { t } = useTranslation();
    const { colors } = useTheme();
    const navigation = useNavigation<ServerRegistrationScreenNavigationProp>();
    const route = useRoute<NativeStackScreenProps<RootStackParamList, 'ServerRegistration'>['route']>();
    const { serverId } = route.params || {};
  
    const commonContainerStyles = getCommonContainerStyles(colors);
    const commonInputStyles = getCommonInputStyles(colors);
    const drizzleDb = useDrizzle();
    const scrollBottomPadding = useFormScrollBottomPadding();
    const serverService = useRef(createServerService(drizzleDb)).current;
    const { setActiveServer } = useUserSettingsStore();
  
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [serverAddress, setServerAddress] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState(''); // Password will only be used for registration, not for editing
    const [confirmPassword, setConfirmPassword] = useState(''); // Only used when mode === 'register'
    const [serverName, setServerName] = useState('');
    const [loading, setLoading] = useState(true); // Changed to true to indicate loading initially
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      const loadServer = async () => {
        if (serverId) {
          try {
            setLoading(true);
            const fetchedServer = await serverService.getServerById(serverId);
            if (fetchedServer) {
              setServerAddress(fetchedServer.url);
              setUsername(fetchedServer.userName);
              setServerName(fetchedServer.name || '');
              // Password is not loaded for editing for security reasons
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
          setLoading(false);
        }
      };
      loadServer();
    }, [serverId, serverService, t]);
  
    const handleSave = useCallback(async () => {
      if (!serverAddress.trim() || !username.trim()) {
        AppAlert.alert(t('error'), t('all_fields_required_except_password_for_edit')); // New translation key
        return;
      }
  
      if (!serverId && !password.trim()) { // Password is required only for new registration
        AppAlert.alert(t('error'), t('password_required_for_registration')); // New translation key
        return;
      }

      // Creating a brand-new account (as opposed to logging into an existing one) needs its
      // own, stricter checks - a typo'd password here would lock the user out of an account
      // they just made, with nothing yet synced anywhere to recover from.
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

      // The userId from useUserSettingsStore is the local client ID, not the server-specific ID.
      // We will get the server-specific userId from the login/registration response.
  
      setLoading(true);
      setError(null);
  
      let existingServer = null; // Declare existingServer here
      if (serverId) {
        existingServer = await serverService.getServerById(serverId);
        if (!existingServer) {
          setError(t('server_not_found'));
          setLoading(false); // Ensure loading is reset if server not found
          return;
        }
      }

      let serverUserId: string | null = null; // Variable to hold the server-provided userId
      let serverUserTag: string | null = existingServer?.tag ?? null;
      let newAccessToken = existingServer ? existingServer.jwtToken : '';
      let newRefreshToken = existingServer ? existingServer.refreshToken : '';
      
      try {
        // 1. Server Check (/kerescheck) - always check if server is reachable
        const keresCheckUrl = `${serverAddress}/kerescheck`;
        const checkResponse = await apiClient.get(keresCheckUrl, {
          timeout: 5000,
          validateStatus: () => true,
        });
  
        if (checkResponse.status !== 200 || !checkResponse.data || typeof checkResponse.data.version !== 'string') {
          AppAlert.alert(t('error'), t('invalid_keres_server'));
          setLoading(false); // Ensure loading is reset on error
          return;
        }
        // 2. Auth (/auth/login or /auth/register) - only for new registration or if password is provided for update.
        // `mode` only ever matters for a brand-new server (`!serverId`) - the toggle isn't even
        // shown otherwise - but the `!serverId` guard here is kept anyway so a stale `mode`
        // value can never send an edit-existing-connection save through /auth/register.
        const isNewServer = !serverId;
        const isPasswordProvided = password.trim().length > 0;
        const isUrlChanged = existingServer && existingServer.url !== serverAddress;
        const isRegistering = isNewServer && mode === 'register';

        if (isNewServer || isPasswordProvided || isUrlChanged) {
          if (isUrlChanged && !isPasswordProvided) {
            AppAlert.alert(t('error'), t('password_required_for_url_change'));
            setLoading(false);
            return;
          }

          const authUrl = `${serverAddress}${isRegistering ? '/auth/register' : '/auth/login'}`;
          const authResponse = await apiClient.post(authUrl, { username, password }, {
            timeout: 5000,
            validateStatus: () => true,
          });

          if (authResponse.status !== 200 || !authResponse.data || !authResponse.data.accessToken || !authResponse.data.refreshToken || !authResponse.data.userId) { // Added check for userId
            if (authResponse.status === 401) {
              AppAlert.alert(t('error'), t('invalid_credentials'));
              setLoading(false); // Make sure loading is set to false here as well
              return;
            } else if (authResponse.status === 409) {
              AppAlert.alert(t('error'), t('user_already_exists'));
              setLoading(false); // Make sure loading is set to false here as well
              return;
            } else if (authResponse.status === 403) {
              AppAlert.alert(t('error'), t('registration_closed'));
              setLoading(false);
              return;
            } else {
              AppAlert.alert(t('error'), `${t('server_error')}: ${authResponse.status}`);
              setLoading(false); // Make sure loading is set to false here as well
              return;
            }
          }
          newAccessToken = authResponse.data.accessToken;
          newRefreshToken = authResponse.data.refreshToken;
          serverUserId = authResponse.data.userId; // Extract the server-provided userId
          serverUserTag = authResponse.data.tag ?? serverUserTag;
        } else {
          // If not re-authenticating, use the existing server's idUser
          serverUserId = existingServer?.idUser || null;
        }

        if (!serverUserId) { // Ensure serverUserId is available
          AppAlert.alert(t('error'), t('user_not_identified_on_server')); // New translation key
          setLoading(false);
          return;
        }
  
        const serverData = {
          idUser: serverUserId, // Use the server-provided userId
          userName: username,
          tag: serverUserTag,
          name: serverName || serverAddress,
          url: serverAddress,
          jwtToken: newAccessToken,
          refreshToken: newRefreshToken,
        };
  
        let savedServer;
        if (serverId) {
          await serverService.updateServer(serverId, serverData);
          savedServer = await serverService.getServerById(serverId); // Retrieve updated server
          AppAlert.alert(t('success'), t('server_updated_successfully'));
        } else {
          savedServer = await serverService.createServer({ ...serverData, lastSyncDate: new Date() }); // Create and get the new server
          AppAlert.alert(t('success'), t('server_registered_successfully'));
        }
        
        if (savedServer) {
          setActiveServer(savedServer); // Set the active server in Zustand store
        }
        navigation.goBack();
  
      } catch (err) {
        let errorMessage = t('failed_to_save_server'); // New translation key
  
        if (err instanceof Error) {
          errorMessage = err.message;
        }
  
        setError(errorMessage);
        AppAlert.alert(t('error'), errorMessage);
      } finally {
        setLoading(false);
      }
    }, [serverAddress, username, password, confirmPassword, serverName, serverService, navigation, t, serverId, mode, setActiveServer]);
  
    const handleDeleteServer = useCallback(() => {
      AppAlert.alert(
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
              if (serverId) {
                try {
                  setLoading(true);
                  await serverService.deleteServer(serverId);
                  AppAlert.alert(t('success'), t('server_deleted_successfully'));
                  navigation.goBack();
                } catch (err) {
                  console.error('Failed to delete server:', err);
                  setError(t('failed_to_delete_server'));
                  AppAlert.alert(t('error'), t('failed_to_delete_server'));
                } finally {
                  setLoading(false);
                }
              }
            },
            style: 'destructive',
          },
        ],
        { cancelable: true }
      );
    }, [serverId, serverService, navigation, t]);
  
  
    if (loading) {
      return (
        <View style={[commonContainerStyles.container, styles.centered]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.text, marginTop: 10 }}>{t('loading_server_data')}</Text>
        </View>
      );
    }
  
    if (error && serverId) { // Only show error if editing existing server and something went wrong
      return (
        <View style={[commonContainerStyles.container, styles.centered]}>
          <Text style={{ color: colors.error }}>{error}</Text>
          <Button onPress={() => navigation.goBack()}>{t('go_back')}</Button>
        </View>
      );
    }
  
    return (
    <KeyboardAwareScreen style={commonContainerStyles.container} contentContainerStyle={[styles.scrollViewContent, { paddingBottom: scrollBottomPadding }]}>
            <Text style={[styles.title, { color: colors.text }]}>
              {serverId ? t('edit_server') : t('register_new_server')}
            </Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
              {serverId ? t('edit_server_description') : t('register_new_server_description')}
            </Text>

            {!serverId && (
              <View style={[styles.modeToggleRow, { borderColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.modeToggleButton, mode === 'login' && { backgroundColor: colors.primary }]}
                  onPress={() => setMode('login')}
                >
                  <Text style={[styles.modeToggleText, { color: mode === 'login' ? colors.onPrimary : colors.text }]}>
                    {t('log_in')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeToggleButton, mode === 'register' && { backgroundColor: colors.primary }]}
                  onPress={() => setMode('register')}
                >
                  <Text style={[styles.modeToggleText, { color: mode === 'register' ? colors.onPrimary : colors.text }]}>
                    {t('create_account')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.label, { color: colors.text }]}>{t('server_address')}</Text>
            <TextInput
              placeholder={t('server_address_placeholder')}
              value={serverAddress}
              onChangeText={setServerAddress}
              style={commonInputStyles.input}
              keyboardType="url"
              autoCapitalize="none"
            />
  
            <Text style={[styles.label, { color: colors.text }]}>{t('server_name_optional')}</Text>
            <TextInput
              placeholder={t('server_name_placeholder')}
              value={serverName}
              onChangeText={setServerName}
              style={commonInputStyles.input}
            />
  
            <Text style={[styles.label, { color: colors.text }]}>{t('username')}</Text>
            <TextInput
              placeholder={t('username_placeholder')}
              value={username}
              onChangeText={setUsername}
              style={commonInputStyles.input}
              autoCapitalize="none"
            />
  
            {!serverId && ( // Only show password field for new registrations
              <>
                <Text style={[styles.label, { color: colors.text }]}>{t('password')}</Text>
                <TextInput
                  placeholder={t('password_placeholder')}
                  value={password}
                  onChangeText={setPassword}
                  style={commonInputStyles.input}
                  secureTextEntry
                />
              </>
            )}

            {!serverId && mode === 'register' && (
              <>
                <Text style={[styles.label, { color: colors.text }]}>{t('confirm_new_password')}</Text>
                <TextInput
                  placeholder={t('confirm_new_password_placeholder')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  style={commonInputStyles.input}
                  secureTextEntry
                />
              </>
            )}
  
            {serverId && ( // Option to change password for existing server
              <>
                <Text style={[styles.label, { color: colors.text }]}>{t('new_password_optional')}</Text>
                <TextInput
                  placeholder={t('new_password_placeholder')}
                  value={password}
                  onChangeText={setPassword}
                  style={commonInputStyles.input}
                  secureTextEntry
                />
                <Text style={{color: colors.textSecondary, marginBottom: 20}}>
                  {t('change_password_warning')}
                </Text>
              </>
            )}
  
            <Button onPress={handleSave} style={styles.registerButton} disabled={loading}>
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : (
                serverId ? t('update_server') : mode === 'register' ? t('create_account') : t('register_server')
              )}
            </Button>
  
            {serverId && (
              <Button onPress={handleDeleteServer} style={[styles.registerButton, styles.deleteButton]} disabled={loading}>
                {t('delete_server')}
              </Button>
            )}
  
            {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
    </KeyboardAwareScreen>
    );};

const styles = StyleSheet.create({
  scrollViewContent: {
    padding: 20,
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  modeToggleRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
  },
  modeToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modeToggleText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  registerButton: {
    marginTop: 30,
    marginBottom: 20,
  },
  errorText: {
    marginTop: 10,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: 'red',
  },
});

export default ServerRegistrationScreen;
