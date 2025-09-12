import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

import { ApiClient } from '@/src/infrastructure/api/ApiClient';
import { ApiAuthRepository } from '@/src/infrastructure/repositories/ApiAuthRepository';

// Instantiate API client and repository outside the component to avoid re-creation on re-renders
const apiClient = new ApiClient();
const authRepository = new ApiAuthRepository(apiClient);

export default function OnlineLoginScreen() {
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();

  useEffect(() => {
    // Load last used base URL on component mount
    const loadLastBaseUrl = async () => {
      const lastUrl = await ApiAuthRepository.getLastBaseUrl();
      if (lastUrl) {
        setBaseUrl(lastUrl);
      }
    };
    loadLastBaseUrl();
  }, []);

  const handleLogin = async () => {
    try {
      const authTokens = await authRepository.login(username, password, baseUrl);
      signIn(authTokens.userId, authTokens.token, authTokens.refreshToken);
      Alert.alert('Login Successful', 'You are now logged in online!');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'An unknown error occurred.');
      console.error('Online login error:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Online Login</ThemedText>
      <ThemedText>Enter your server details to log in.</ThemedText>

      <TextInput
        style={styles.input}
        placeholder="Base URL (e.g., http://localhost:3000)"
        value={baseUrl}
        onChangeText={setBaseUrl}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Username"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Button title="Login" onPress={handleLogin} />

      {/* TODO: Implement URL history/suggestions UI */}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  input: {
    width: '90%',
    padding: 10,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    color: '#000', // Ensure text is visible in both themes
    backgroundColor: '#fff', // Ensure background is visible in both themes
  },
});
