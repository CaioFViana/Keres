import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import Button from '../components/common/Button/Button';
import TextInput from '../components/common/TextInput/TextInput';
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

  const [serverAddress, setServerAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // Not used yet, but good to have for future functionality

  const handleRegisterServer = () => {
    if (!serverAddress.trim() || !username.trim() || !password.trim()) {
      Alert.alert(t('error'), t('all_fields_required'));
      return;
    }

    // TODO: Implement actual server registration logic here
    console.log('Register Server:', {
      address: serverAddress,
      username: username,
      password: password,
    });
    Alert.alert(t('server_registration_mock_title'), t('server_registration_mock_message'));
    // Clear form
    setServerAddress('');
    setUsername('');
    setPassword('');
    // Optionally navigate back or to server management screen
    // navigation.goBack();
  };

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

          <Button onPress={handleRegisterServer} style={styles.registerButton}>
            {t('register_server')}
          </Button>

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
});

export default ServerRegistrationScreen;
