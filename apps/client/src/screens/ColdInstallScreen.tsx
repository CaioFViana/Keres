import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite'; // Import useSQLiteContext
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import Button from '../components/common/Button/Button';
import FormContainer from '../components/common/FormContainer/FormContainer'; // Import FormContainer
import Select from '../components/common/Select/Select'; // Import our new Select component
import TextInput from '../components/common/TextInput/TextInput';
import { useDrizzle } from '../db'; // Import useDrizzle
import { migrate } from '../db/migrate'; // Import migrate
import { createClientSettings } from '../services/ClientSettingsService'; // Import createClientSettings
import { useThemeStore } from '../state/themeStore'; // Import useThemeStore
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../theme/commonStyles'; // Import common styles
import i18n from '../utils/i18n';

type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: undefined;
};

type ColdInstallScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ColdInstall'>;

const ColdInstallScreen = () => {
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [languageError, setLanguageError] = useState<string | null>(null);
  const { t } = useTranslation();
  const navigation = useNavigation<ColdInstallScreenNavigationProp>();
  const { colors } = useTheme();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);

  const db = useSQLiteContext(); // Get the raw SQLite database instance
  const drizzleDb = useDrizzle(); // Get the Drizzle client from context

  const initializeUserSettings = useUserSettingsStore((state) => state.initializeSettings);
  const initializeThemeSettings = useThemeStore((state) => state.initializeTheme);

  const commonContainerStyles = getCommonContainerStyles(colors); // Get common container styles
  const commonInputStyles = getCommonInputStyles(colors); // Get common input styles

  const backPressTimer = useRef<number | null>(null);

  useEffect(() => {
    const backAction = () => {
      if (backPressTimer.current && Date.now() - backPressTimer.current < 2000) {
        // If pressed again within 2 seconds, exit the app
        BackHandler.exitApp();
        return true; // Event handled
      } else {
        backPressTimer.current = Date.now();
        ToastAndroid.show(t('press_back_again_to_exit'), ToastAndroid.SHORT);
        return true; // Event handled, but don't exit yet
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [t]);


  const handleProceed = async () => {
    let isValid = true;

    if (!selectedLanguage) {
      setLanguageError(t('select_language_error'));
      isValid = false;
    } else {
      setLanguageError(null);
    }

    if (username.length < 3 || username.length > 99) {
      setUsernameError(t('username_length_error'));
      isValid = false;
    } else {
      setUsernameError(null);
    }

    if (!isValid) {
      return;
    }

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

  const isProceedDisabled = !selectedLanguage || username.length < 3 || username.length > 99;

  const styles = StyleSheet.create({
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
    },
    pickerContainer: {
      width: '80%',
      marginBottom: 20,
    },
    errorText: {
      color: colors.error,
      marginBottom: 10,
    },
  });

  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Português', value: 'pt' },
  ];

  return (
    <FormContainer style={commonContainerStyles.container}>
      <Text style={styles.title}>{t('welcome')}</Text>
      <TextInput
        placeholder={t('enter_username')}
        value={username}
        onChangeText={setUsername}
        style={commonInputStyles.input} // Apply common input style
      />
      {usernameError && <Text style={styles.errorText}>{usernameError}</Text>}
      <View style={styles.pickerContainer}>
        <Select
          options={languageOptions}
          value={selectedLanguage}
          onValueChange={handleLanguageChange}
          placeholder={t('select_language')}
        />
      </View>
      {languageError && <Text style={styles.errorText}>{languageError}</Text>}
      <Button onPress={handleProceed} disabled={isProceedDisabled}>{t('proceed')}</Button>
    </FormContainer>
  );
};

export default ColdInstallScreen;
