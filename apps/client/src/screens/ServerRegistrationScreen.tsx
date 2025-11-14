import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import axios, { AxiosError } from 'axios'; // Import AxiosError
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../components/common/Button/Button';
import TextInput from '../components/common/TextInput/TextInput';
import { useDrizzle } from '../db';
import { createServerService } from '../services/ServerService';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../theme/commonStyles';

type RootStackParamList = {
  ServerRegistration: undefined;
  ServerManagement: undefined;
};

type ServerRegistrationScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ServerRegistration'>;

const ServerRegistrationScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<ServerRegistrationScreenNavigationProp>();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const serverService = useRef(createServerService(drizzleDb)).current;
  const { userId } = useUserSettingsStore();

  const [serverAddress, setServerAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [serverName, setServerName] = useState(''); // New state for server name
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegisterServer = useCallback(async () => {
    if (!serverAddress.trim() || !username.trim() || !password.trim()) {
      Alert.alert(t('error'), t('all_fields_required'));
      return;
    }

    if (!userId) {
      Alert.alert(t('error'), t('user_not_identified'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Server Check (/kerescheck)
      const keresCheckUrl = `${serverAddress}/kerescheck`;
      const checkResponse = await axios.get(keresCheckUrl, { timeout: 5000 }); // Add timeout

      if (checkResponse.status !== 200 || !checkResponse.data || typeof checkResponse.data.version !== 'string') {
        throw new Error(t('invalid_keres_server'));
      }
      const serverVersion = checkResponse.data.version;

      // 2. Login (/auth/login)
      const loginUrl = `${serverAddress}/auth/login`;
      const loginResponse = await axios.post(loginUrl, { username, password }, { timeout: 5000 }); // Add timeout

      if (loginResponse.status !== 200 || !loginResponse.data || !loginResponse.data.accessToken || !loginResponse.data.refreshToken) {
        throw new Error(t('invalid_credentials'));
      }
      const { accessToken, refreshToken } = loginResponse.data;

      // 3. Save Server
      await serverService.createServer({
        idUser: userId,
        userName: username,
        name: serverName || serverAddress,
        url: serverAddress,
        jwtToken: accessToken,
        refreshToken: refreshToken,
        lastSyncDate: new Date(), // Set initial sync date
      });

      Alert.alert(t('success'), t('server_registered_successfully'));
      // Clear form and navigate back
      setServerAddress('');
      setUsername('');
      setPassword('');
      setServerName('');
      navigation.goBack();

    } catch (err) {
      console.error('Server registration failed:', err);
      let errorMessage = t('failed_to_register_server');

      if (axios.isAxiosError(err)) {
        const axiosError = err as AxiosError;
        if (axiosError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          if (axiosError.response.status === 401) {
            errorMessage = t('invalid_credentials');
          } else if (axiosError.response.status === 409) {
            errorMessage = t('user_already_exists'); // Assuming 409 for user exists
          } else if (axiosError.response.data && typeof axiosError.response.data === 'object' && 'message' in axiosError.response.data) {
            errorMessage = axiosError.response.data.message as string;
          } else {
            errorMessage = `${t('server_error')}: ${axiosError.response.status}`;
          }
        } else if (axiosError.request) {
          // The request was made but no response was received
          errorMessage = t('network_error_no_response');
        } else {
          // Something happened in setting up the request that triggered an Error
          errorMessage = `${t('request_setup_error')}: ${axiosError.message}`;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      Alert.alert(t('error'), errorMessage);
    } finally {
      setLoading(false);
    }
  }, [serverAddress, username, password, serverName, userId, serverService, navigation, t]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView style={commonContainerStyles.container} contentContainerStyle={styles.scrollViewContent}>
          <Text style={[styles.title, { color: colors.text }]}>{t('register_new_server')}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 20 }}>
            {t('register_new_server_description')}
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

          <Text style={[styles.label, { color: colors.text }]}>{t('password')}</Text>
          <TextInput
            placeholder={t('password_placeholder')}
            value={password}
            onChangeText={setPassword}
            style={commonInputStyles.input}
            secureTextEntry
          />

          <Button onPress={handleRegisterServer} style={styles.registerButton} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.onPrimary} /> : t('register_server')}
          </Button>

          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

          <View style={{ height: 90 }} />
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

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
});

export default ServerRegistrationScreen;
