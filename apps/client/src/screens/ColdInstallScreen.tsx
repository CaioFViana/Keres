import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite'; // Import useSQLiteContext
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import Select from '../components/Select/Select'; // Import our new Select component
import { useDrizzle } from '../db'; // Import useDrizzle
import { migrate } from '../db/migrate'; // Import migrate
import { createClientSettings } from '../services/ClientSettingsService'; // Import createClientSettings
import { useThemeStore } from '../state/themeStore'; // Import useThemeStore
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import i18n from '../utils/i18n';

type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: undefined;
};

type ColdInstallScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ColdInstall'>;

const ColdInstallScreen = () => {
  const [username, setUsername] = useState('');
  const { t } = useTranslation();
  const navigation = useNavigation<ColdInstallScreenNavigationProp>();
  const { colors } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const db = useSQLiteContext(); // Get the raw SQLite database instance
  const drizzleDb = useDrizzle(); // Get the Drizzle client from context

  const initializeUserSettings = useUserSettingsStore((state) => state.initializeSettings);
  const initializeThemeSettings = useThemeStore((state) => state.initializeTheme);


  const handleProceed = async () => {
    // Run database migrations first
    await migrate(db); // Use the raw db instance for migrations

    // Create initial client settings in SQLite
    await createClientSettings(drizzleDb, { // Pass drizzleDb
      localUsername: username,
      language: selectedLanguage || 'en', // Default to English if not selected
      darkMode: false, // Default to light mode
    });

    // Initialize stores with the newly created settings
    await initializeUserSettings(drizzleDb);
    await initializeThemeSettings(drizzleDb);

    navigation.replace('StorySelection');
  };

  const handleLanguageChange = (itemValue: string | null) => {
    setSelectedLanguage(itemValue);
    if (itemValue) {
      i18n.changeLanguage(itemValue);
      // No need to call setStoreLanguage here, as it will be set during handleProceed
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
    },
    input: {
      width: '80%',
      height: 40,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      marginBottom: 20,
      color: colors.text,
      backgroundColor: colors.surface,
    },
    pickerContainer: {
      width: '80%',
      marginBottom: 20,
    },
  });

  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Português', value: 'pt' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('welcome')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('enter_username')}
        placeholderTextColor={colors.textSecondary}
        value={username}
        onChangeText={setUsername}
      />
      <View style={styles.pickerContainer}>
        <Select
          options={languageOptions}
          value={selectedLanguage}
          onValueChange={handleLanguageChange}
          placeholder={t('select_language')}
        />
      </View>
      <Button title={t('proceed')} onPress={handleProceed} color={colors.primary} />
    </View>
  );
};

export default ColdInstallScreen;
