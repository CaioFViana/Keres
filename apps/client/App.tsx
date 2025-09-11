import React, { useState } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, Text } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import WelcomeScreen from './src/screens/WelcomeScreen';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [selectedMode, setSelectedMode] = useState<'online' | 'offline' | null>(null);

  const handleSelectMode = (mode: 'online' | 'offline') => {
    setSelectedMode(mode);
    console.log(`Selected mode: ${mode}`);
    // Here you would navigate to the appropriate screen based on the mode
  };

  return (
    <View style={styles.container}>
      {selectedMode === null ? (
        <WelcomeScreen onSelectMode={handleSelectMode} />
      ) : (
        <View style={styles.modeSelectedContainer}>
          <Text style={styles.modeSelectedText}>Mode Selected: {selectedMode}</Text>
          <Text style={styles.modeSelectedText}>This will navigate to the next screen.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modeSelectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeSelectedText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default App;
