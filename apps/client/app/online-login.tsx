import { useAuth } from '@/context/AuthContext';
import React, { useEffect, useState } from 'react';
import { Button, StyleSheet, TextInput } from 'react-native';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleLogin = async () => {
    setErrorMessage(null); // Clear previous errors

    if (!validateUrl(baseUrl)) {
      setErrorMessage('Please enter a valid Base URL (e.g., http://localhost:3000).');
      return;
    }

    if (!username || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    try {
      const authTokens = await authRepository.login(username, password, baseUrl);
      signIn(authTokens.userId, authTokens.token, authTokens.refreshToken, baseUrl);
      // No Alert.alert needed, AuthContext handles redirection
    } catch (error: any) {
      console.error('Online login error object:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
        setErrorMessage('Could not connect to the server. Please check the Base URL and your internet connection.');
      } else if (error.message) {
        setErrorMessage(`Login Failed: ${error.message}`);
      } else {
        setErrorMessage('An unknown error occurred during login.');
      }
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

      {errorMessage && <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>}

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
  errorText: {
    color: 'red',
    marginTop: 10,
    textAlign: 'center',
  },
});