import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native'; // Import Alert
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Import NativeStackNavigationProp
import Select from '../components/common/Select/Select';
import TextInput from '../components/common/TextInput/TextInput';
import { useDrizzle, resetDatabase } from '../db'; // Import resetDatabase
import { useThemeStore } from '../state/themeStore';
import { useUserSettingsStore } from '../state/userSettingsStore';
import { useTheme } from '../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../theme/commonStyles';
import i18n from '../utils/i18n';
import { getLanguageOptions } from '../utils/languageOptions';
import { useSQLiteContext } from 'expo-sqlite';
import Button from '../components/common/Button/Button';

type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: undefined;
};

type SettingsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ColdInstall'>;

const SettingsScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleClient = useDrizzle(); // Initialize useDrizzle
  const db = useSQLiteContext(); 
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const { username, language, setUsername, setLanguage, resetSettings } = useUserSettingsStore();
  const { darkMode, setDarkMode, resetTheme } = useThemeStore();

  const handleUsernameChange = (newUsername: string) => {
    setUsername(drizzleClient, newUsername);
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(drizzleClient, newLanguage);
    i18n.changeLanguage(newLanguage);
  };

  const handleDarkModeToggle = (value: boolean) => {
    setDarkMode(drizzleClient, value);
  };

  const handleResetApplication = () => {
    Alert.alert(
      t('reset_application_title'),
      t('reset_application_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('reset'),
          onPress: async () => {
            try {
              await resetDatabase(db);
              console.log('Database reset complete.');

              // Reset Zustand stores
              resetSettings();
              resetTheme();
              console.log('Zustand stores reset.');

              // Navigate to ColdInstallScreen and reset navigation stack
              navigation.replace('ColdInstall');
              console.log('Navigated to ColdInstallScreen.');
            } catch (error) {
              console.error('Error resetting application:', error);
              Alert.alert(t('error'), t('reset_application_error'));
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true }
    );
  };

  const languageOptions = getLanguageOptions(t);

  return (
    <View style={commonContainerStyles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('settings')}</Text>

      <View style={styles.settingItem}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{t('username')}</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            value={username || 'Keres User'}
            onChangeText={handleUsernameChange}
            placeholder={t('enter_username')}
            style={[commonInputStyles.input, styles.input]}
          />
        </View>
      </View>

      <View style={styles.settingItem}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{t('select_language')}</Text>
        <View style={styles.selectWrapper}>
          <Select
            options={languageOptions}
            value={language || 'en'}
            onValueChange={handleLanguageChange}
            placeholder={t('select_language')}
          />
        </View>
      </View>

      <View style={styles.settingItem}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{t('dark_mode')}</Text>
        <Switch
          value={darkMode}
          onValueChange={handleDarkModeToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={darkMode ? colors.onPrimary : colors.textSecondary}
        />
      </View>

      <Button onPress={handleResetApplication} style={{ marginTop: 20 }}>
        {t('reset_application')}
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc', // Placeholder, will use theme colors
  },
  settingLabel: {
    fontSize: 18, // Increased font size
    fontWeight: 'bold', // Made font bold
  },
  input: {
    marginBottom: 0
  },
  inputWrapper: {
    flex: 2,
    width: '80%',
    marginLeft: 10,
    alignItems: 'flex-end', // Align children (TextInput) to the right
  },
  selectWrapper: {
    width: 150, // Fixed width for the select component
    marginLeft: 10, // Add margin to separate from label
    height: 50, // Explicitly set height to match TextInput
  },
});

export default SettingsScreen;