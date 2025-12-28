import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../../components/common/Button/Button';
import TextInput from '../../components/common/TextInput/TextInput';
import { useDrizzle } from '../../db';
import apiClient from '../../services/apiClient';
import { createServerService } from '../../services/ServerService';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';

type RootStackParamList = {
  ServerRegistration: { serverId?: string };
  ServerManagement: undefined;
};

type ServerRegistrationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ServerRegistration'>;

const ServerRegistrationScreen = () => {
    useBackButtonHandler()
    const { t } = useTranslation();
    const { colors } = useTheme();
    const navigation = useNavigation<ServerRegistrationScreenNavigationProp>();
    const route = useRoute<NativeStackScreenProps<RootStackParamList, 'ServerRegistration'>['route']>();
    const { serverId } = route.params || {};
  
    const commonContainerStyles = getCommonContainerStyles(colors);
    const commonInputStyles = getCommonInputStyles(colors);
    const drizzleDb = useDrizzle();
    const serverService = useRef(createServerService(drizzleDb)).current;
    const { userId, setActiveServer } = useUserSettingsStore();
  
    const [serverAddress, setServerAddress] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState(''); // Password will only be used for registration, not for editing
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
        Alert.alert(t('error'), t('all_fields_required_except_password_for_edit')); // New translation key
        return;
      }
  
      if (!serverId && !password.trim()) { // Password is required only for new registration
        Alert.alert(t('error'), t('password_required_for_registration')); // New translation key
        return;
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
          Alert.alert(t('error'), t('invalid_keres_server'));
          setLoading(false); // Ensure loading is reset on error
          return;
        }
        const serverVersion = checkResponse.data.version;
  
        // 2. Login (/auth/login) - only for new registration or if password is provided for update
        const isNewServer = !serverId;
        const isPasswordProvided = password.trim().length > 0;
        const isUrlChanged = existingServer && existingServer.url !== serverAddress;

        if (isNewServer || isPasswordProvided || isUrlChanged) {
          if (isUrlChanged && !isPasswordProvided) {
            Alert.alert(t('error'), t('password_required_for_url_change'));
            setLoading(false);
            return;
          }

          const loginUrl = `${serverAddress}/auth/login`;
          const loginResponse = await apiClient.post(loginUrl, { username, password }, {
            timeout: 5000,
            validateStatus: () => true,
          });
  
          if (loginResponse.status !== 200 || !loginResponse.data || !loginResponse.data.accessToken || !loginResponse.data.refreshToken || !loginResponse.data.userId) { // Added check for userId
            if (loginResponse.status === 401) {
              Alert.alert(t('error'), t('invalid_credentials'));
              setLoading(false); // Make sure loading is set to false here as well
              return;
            } else if (loginResponse.status === 409) {
              Alert.alert(t('error'), t('user_already_exists'));
              setLoading(false); // Make sure loading is set to false here as well
              return;
            } else {
              Alert.alert(t('error'), `${t('server_error')}: ${loginResponse.status}`);
              setLoading(false); // Make sure loading is set to false here as well
              return;
            }
          }
          newAccessToken = loginResponse.data.accessToken;
          newRefreshToken = loginResponse.data.refreshToken;
          serverUserId = loginResponse.data.userId; // Extract the server-provided userId
        } else {
          // If not re-authenticating, use the existing server's idUser
          serverUserId = existingServer?.idUser || null;
        }

        if (!serverUserId) { // Ensure serverUserId is available
          Alert.alert(t('error'), t('user_not_identified_on_server')); // New translation key
          setLoading(false);
          return;
        }
  
        const serverData = {
          idUser: serverUserId, // Use the server-provided userId
          userName: username,
          name: serverName || serverAddress,
          url: serverAddress,
          jwtToken: newAccessToken,
          refreshToken: newRefreshToken,
        };
  
        let savedServer;
        if (serverId) {
          await serverService.updateServer(serverId, serverData);
          savedServer = await serverService.getServerById(serverId); // Retrieve updated server
          Alert.alert(t('success'), t('server_updated_successfully'));
        } else {
          savedServer = await serverService.createServer({ ...serverData, lastSyncDate: new Date() }); // Create and get the new server
          Alert.alert(t('success'), t('server_registered_successfully'));
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
        Alert.alert(t('error'), errorMessage);
      } finally {
        setLoading(false);
      }
    }, [serverAddress, username, password, serverName, serverService, navigation, t, serverId]);
  
    const handleDeleteServer = useCallback(() => {
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
              if (serverId) {
                try {
                  setLoading(true);
                  await serverService.deleteServer(serverId);
                  Alert.alert(t('success'), t('server_deleted_successfully'));
                  navigation.goBack();
                } catch (err) {
                  console.error('Failed to delete server:', err);
                  setError(t('failed_to_delete_server'));
                  Alert.alert(t('error'), t('failed_to_delete_server'));
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
            <Text style={[styles.title, { color: colors.text }]}>
              {serverId ? t('edit_server') : t('register_new_server')}
            </Text>
            <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
              {serverId ? t('edit_server_description') : t('register_new_server_description')}
            </Text>
  
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
              {loading ? <ActivityIndicator color={colors.onPrimary} /> : (serverId ? t('update_server') : t('register_server'))}
            </Button>
  
            {serverId && (
              <Button onPress={handleDeleteServer} style={[styles.registerButton, styles.deleteButton]} disabled={loading}>
                {t('delete_server')}
              </Button>
            )}
  
            {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
  
            <View style={{ height: 90 }} />
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
