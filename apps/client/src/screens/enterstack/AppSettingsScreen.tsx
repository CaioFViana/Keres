import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { StackActions, useNavigation } from '@react-navigation/native'; // Import useNavigation and StackActions
import { useSQLiteContext } from 'expo-sqlite';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { APP_RELEASE } from '@keres/shared';
import type { GregorianDateDisplayFormat } from '@keres/shared';
import { resetDatabase, useDrizzle } from '../../db'; // Import resetDatabase
import { servers } from '../../db/schema';
import type { StorySelectionDrawerParamList } from '../../navigation/StorySelectionStack';
import { authTokenManager, setAuthDb } from '../../services/AuthTokenManager';
import { mediaFileService } from '../../services/MediaFileService';
import { SyncEngineService } from '../../services/SyncEngineService'; // Import SyncEngineService
import { resetAllClientStores } from '../../state/resetAllClientStores';
import { useThemeStore } from '../../state/themeStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import i18n, { getLanguageOptions } from '../../utils/i18n';

type SettingsScreenNavigationProp = DrawerNavigationProp<StorySelectionDrawerParamList, 'Settings'>;

const SettingsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  useScreenHeader({ target: 'self', title: t('settings_title') });
  const { colors } = useTheme();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const drizzleClient = useDrizzle(); // Initialize useDrizzle
  const db = useSQLiteContext();
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const {
    username,
    language,
    use24HourTime,
    dateDisplayFormat,
    showContextualHelp,
    suggestLiteraryDevices,
    setUsername,
    setLanguage,
    setUse24HourTime,
    setDateDisplayFormat,
    setShowContextualHelp,
    setSuggestLiteraryDevices,
    resetSettings,
  } = useUserSettingsStore();
  const { darkMode, setDarkMode, resetTheme } = useThemeStore();

  const handleUsernameChange = (newUsername: string) => {
    setUsername(drizzleClient, newUsername);
  };

  const handleLanguageChange = (newLanguage: string | null) => {
    // If newLanguage is null, default to 'en' or keep current language
    const languageToSet = newLanguage || 'en'; // Assuming 'en' as a sensible default
    setLanguage(drizzleClient, languageToSet);
    i18n.changeLanguage(languageToSet);
  };

  const handleDarkModeToggle = (value: boolean) => {
    setDarkMode(drizzleClient, value);
  };

  const handleTimeFormatToggle = (value: boolean) => {
    setUse24HourTime(drizzleClient, value);
  };

  const handleDateDisplayFormatChange = (value: string | null) => {
    if (value === 'iso' || value === 'dmy' || value === 'mdy') {
      setDateDisplayFormat(drizzleClient, value as GregorianDateDisplayFormat);
    }
  };

  const handleContextualHelpToggle = (value: boolean) => {
    setShowContextualHelp(drizzleClient, value);
  };

  const handleLiteraryDevicesToggle = (value: boolean) => {
    setSuggestLiteraryDevices(drizzleClient, value);
  };

  const handleResetApplication = () => {
    AppAlert.alert(
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
              // Credentials live outside SQLite, so retain the server IDs before dropping
              // any tables. The reset signal synchronously closes every realtime socket.
              const savedServers = await drizzleClient
                .select({ id: servers.id })
                .from(servers)
                .all();
              const serverIds = savedServers.map((server) => server.id);
              const realtimeShutdown = entityEventEmitter.emitAsync('application_resetting');

              // Clearing the user first prevents SyncInitializer effects from rebuilding a
              // WebSocket while the remaining asynchronous cleanup is still in progress.
              resetSettings();
              await Promise.all([realtimeShutdown, SyncEngineService.getInstance().reset()]);
              await authTokenManager.clearAllAuth(serverIds);
              setAuthDb(null);
              await mediaFileService.deleteAllMedia();

              await resetDatabase(db);
              console.log('Database reset complete.');

              // Reset every in-memory store that can retain rows from the deleted database.
              resetAllClientStores();
              resetTheme();
              console.log('Credentials, media, stores and synchronization services reset.');

              // Navigate to ColdInstallScreen and reset navigation stack
              navigation.dispatch(StackActions.replace('ColdInstall'));
              console.log('Navigated to ColdInstallScreen.');
            } catch (error) {
              console.error('Error resetting application:', error);
              AppAlert.alert(t('error'), t('reset_application_error'));
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  const languageOptions = getLanguageOptions(t);
  const brandImageSize = Math.min(
    Math.max(Math.min(screenWidth * 0.44, screenHeight * 0.28), 132),
    256,
  );

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.settings}>
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
            <SingleSelectPill
              options={languageOptions}
              value={language || 'en'}
              onValueChange={handleLanguageChange as (value: string | null) => void}
              placeholder={t('select_language')}
            />
          </View>
        </View>

        <View style={styles.settingItem}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>{t('dark_mode')}</Text>
          <ThemedSwitch value={darkMode} onValueChange={handleDarkModeToggle} />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingTextWrap}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              {t('use_24_hour_time')}
            </Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              {use24HourTime ? t('use_24_hour_time_on') : t('use_24_hour_time_off')}
            </Text>
          </View>
          <ThemedSwitch value={use24HourTime} onValueChange={handleTimeFormatToggle} />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingTextWrap}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              {t('date_display_format')}
            </Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              {t('date_display_format_hint')}
            </Text>
          </View>
          <View style={styles.dateFormatSelectWrapper}>
            <SingleSelectPill
              options={[
                { label: t('date_display_format_iso'), value: 'iso' },
                { label: t('date_display_format_dmy'), value: 'dmy' },
                { label: t('date_display_format_mdy'), value: 'mdy' },
              ]}
              value={dateDisplayFormat}
              onValueChange={handleDateDisplayFormatChange}
              placeholder={t('date_display_format')}
            />
          </View>
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingTextWrap}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              {t('suggest_literary_devices')}
            </Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              {suggestLiteraryDevices
                ? t('suggest_literary_devices_on')
                : t('suggest_literary_devices_off')}
            </Text>
          </View>
          <ThemedSwitch
            value={suggestLiteraryDevices}
            onValueChange={handleLiteraryDevicesToggle}
            style={styles.contextualHelpSwitch}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingTextWrap}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>
              {t('show_contextual_help')}
            </Text>
            <Text style={[styles.settingHint, { color: colors.textSecondary }]}>
              {showContextualHelp ? t('show_contextual_help_on') : t('show_contextual_help_off')}
            </Text>
          </View>
          <ThemedSwitch
            value={showContextualHelp}
            onValueChange={handleContextualHelpToggle}
            style={styles.contextualHelpSwitch}
          />
        </View>

        <Button onPress={handleResetApplication} style={{ marginTop: 10 }}>
          {t('reset_application')}
        </Button>
      </View>

      <View style={styles.branding}>
        <Image
          source={require('../../../assets/images/desktop_icon.png')}
          style={[styles.brandImage, { height: brandImageSize, width: brandImageSize }]}
          resizeMode="contain"
          accessibilityLabel="Keres"
        />
        <Text style={[styles.brandVersion, { color: colors.textSecondary }]}>
          Keres {APP_RELEASE.version} {APP_RELEASE.name}
        </Text>
      </View>
    </KeyboardAwareScreen>
  );
};

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  settings: {
    flexShrink: 0,
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
  settingTextWrap: {
    flexShrink: 1,
    paddingRight: 10,
  },
  settingHint: {
    fontSize: 13,
    marginTop: 2,
  },
  contextualHelpSwitch: {
    marginLeft: 10,
  },
  input: {
    marginBottom: 0,
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
  dateFormatSelectWrapper: {
    width: 250,
    marginLeft: 10,
    height: 50,
  },
  branding: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'flex-end',
    minHeight: 180,
    paddingBottom: 16,
    paddingTop: 36,
  },
  brandImage: {
    opacity: 0.82,
  },
  brandVersion: {
    fontSize: 14,
    letterSpacing: 0.3,
    marginTop: 12,
  },
});

export default SettingsScreen;
