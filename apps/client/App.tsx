import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, Button, Alert } from 'react-native';
import { loginUser } from './src/api'; // Removed getProtectedData as it's not directly used here anymore
import { UserLoginPayload, UserProfileResponse } from '@keres/shared';
import StoryListScreen from './src/screens/StoryListScreen'; // Added

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null); // Added

  const handleLogin = async () => {
    try {
      const credentials: UserLoginPayload = { username, password };
      const response: UserProfileResponse = await loginUser(credentials); // Explicitly type response
      if (response.token && response.id) { // Check for both token and id
        setToken(response.token);
        setUserId(response.id); // Set userId
        Alert.alert('Login Successful', `Welcome, ${response.username}!`);
      } else {
        Alert.alert('Login Failed', 'No token or user ID received.');
      }
    } catch (error: any) {
      Alert.alert('Login Error', error.response?.data?.error || 'Something went wrong.');
    }
  };

  

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Keres Story Organizer</Text>

      {!token ? (
        <View style={styles.form}>
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
        </View>
      ) : (
        <StoryListScreen token={token} userId={userId!} /> // Render StoryListScreen
      )}

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  form: {
    width: '80%',
    maxWidth: 300,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
  loggedInContainer: {
    alignItems: 'center',
  },
  loggedInText: {
    fontSize: 18,
    marginBottom: 20,
    color: 'green',
  },
  protectedDataContainer: {
    marginTop: 30,
    padding: 15,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    width: '100%',
  },
  protectedDataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  protectedDataText: {
    fontSize: 14,
  },
});