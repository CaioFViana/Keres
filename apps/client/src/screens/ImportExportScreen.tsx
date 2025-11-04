import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

const ImportExportScreen = () => {
  const { colors } = useTheme();

  const handleImport = () => {
    console.log('Importing data...');
    // Logic for importing data (e.g., from a JSON file)
  };

  const handleExport = () => {
    console.log('Exporting data...');
    // Logic for exporting data (e.g., to a JSON file)
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
    },
    buttonContainer: {
      marginBottom: 15,
      width: '100%',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import / Export Data</Text>

      <View style={styles.buttonContainer}>
        <Button title="Import Story from JSON" onPress={handleImport} color={colors.primary} />
      </View>

      <View style={styles.buttonContainer}>
        <Button title="Export Story to JSON" onPress={handleExport} color={colors.primary} />
      </View>

      <Text style={{ color: colors.textSecondary, marginTop: 20 }}>
        Use these options to backup your stories or transfer them between devices.
      </Text>
    </View>
  );
};

export default ImportExportScreen;
