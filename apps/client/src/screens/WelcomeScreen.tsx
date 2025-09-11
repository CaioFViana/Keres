import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface WelcomeScreenProps {
  onSelectMode: (mode: 'online' | 'offline') => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectMode }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Keres!</Text>
      <Text style={styles.subtitle}>Choose your operating mode:</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => onSelectMode('online')}
      >
        <Text style={styles.buttonText}>Online Mode</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.button}
        onPress={() => onSelectMode('offline')}
      >
        <Text style={styles.buttonText}>Offline Mode</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
    color: '#666',
  },
  button: {
    backgroundColor: '#007bff',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginVertical: 10,
    width: '70%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default WelcomeScreen;
