import React, { useState } from 'react';
import { StyleSheet, TextInput, Button, Alert } from 'react-native';
import { useAuth } from '@/context/AuthContext';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function OnlineLoginScreen() {
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAuth();

  const handleLogin = async () => {
    // TODO: Implement actual API call to /users/login
    // For now, simulate a successful login
    if (username === 'test' && password === 'password') {
      // Simulate API response with a token and refresh token
      const mockUserId = 'mock-online-user-id';
      const mockToken = 'mock-online-jwt-token';
      const mockRefreshToken = 'mock-online-refresh-token';

      signIn(mockUserId, mockToken, mockRefreshToken);
      Alert.alert('Login Successful', 'You are now logged in online!');
    } else {
      Alert.alert('Login Failed', 'Invalid username or password.');
    }
    console.log('Attempting online login...', { baseUrl, username, password });
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

      {/* TODO: Implement URL history/suggestions using AsyncStorage */}
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
