import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Button } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTheme } from '../theme';
import { useTranslation } from 'react-i18next';
import i18n from '../utils/i18n';

const SettingsScreen = () => {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);

  const handleLanguageChange = (itemValue: string) => {
    setSelectedLanguage(itemValue);
    i18n.changeLanguage(itemValue);
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
    settingItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    settingText: {
      fontSize: 18,
      color: colors.text,
    },
    pickerContainer: {
      width: '50%',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 5,
      backgroundColor: colors.surface,
    },
    picker: {
      height: 40,
      width: '100%',
      color: colors.text,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settings')}</Text>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>{t('dark_mode')}</Text>
        <Switch
          trackColor={{ false: colors.textSecondary, true: colors.primaryVariant }}
          thumbColor={isDarkMode ? colors.primary : colors.surface}
          onValueChange={toggleTheme}
          value={isDarkMode}
        />
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>{t('select_language')}</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selectedLanguage}
            style={styles.picker}
            onValueChange={handleLanguageChange}
          >
            <Picker.Item label="English" value="en" />
            <Picker.Item label="Português" value="pt" />
          </Picker>
        </View>
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>{t('account_settings')}</Text>
        <Button title={t('manage')} onPress={() => console.log('Manage Account')} color={colors.primary} />
      </View>

      <View style={styles.settingItem}>
        <Text style={styles.settingText}>{t('notifications')}</Text>
        <Switch
          trackColor={{ false: colors.textSecondary, true: colors.primaryVariant }}
          thumbColor={isDarkMode ? colors.primary : colors.surface}
          onValueChange={() => console.log('Toggle Notifications')}
          value={true} // Placeholder
        />
      </View>
    </View>
  );
};

export default SettingsScreen;