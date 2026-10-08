import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import { SingleSelectPill } from '@/src/components/common/inputs/MultiSelectPill/MultiSelectPill';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import SettingsGroup from '@/src/components/features/app/SettingsGroup';
import SettingsRow from '@/src/components/features/app/SettingsRow';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { StackActions, useNavigation } from '@react-navigation/native'; // Import useNavigation and StackActions
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { APP_RELEASE } from '@keres/shared';
import type { GregorianDateDisplayFormat } from '@keres/shared';
import type { MapExportFormat } from '@keres/shared/entities/ClientSettings';
import { resetDatabase, useDrizzle } from '../../db'; // Import resetDatabase
import { servers } from '../../db/schema';
import type { SettingsStackParamList } from '../../navigation/StorySelectionStack';
import { authTokenManager, setAuthDb } from '../../services/AuthTokenManager';
import { setEditorDraftDb } from '../../services/EditorDraftService';
import { mediaFileService } from '../../services/MediaFileService';
import {
  CJK_PACK_SIZE_LABEL,
  cjkPackState,
  deleteCjkPack,
  downloadCjkPack,
} from '../../services/cjkFontPack';
import { syncEngine } from '../../services/sync/appSyncEngine';
import { useGuideStore } from '../../state/guideStore';
import { useNotificationStore } from '../../state/notificationStore';
import { resetAllClientStores } from '../../state/resetAllClientStores';
import { useThemeStore } from '../../state/themeStore';
import { useMusicToolsStore } from '../../state/musicToolsStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles, getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';
import { entityEventEmitter } from '../../utils/EventEmitter';
import i18n, { getLanguageOptions } from '../../utils/i18n';
import { normalizeLocalUsername } from '../../utils/localUsername';

type SettingsScreenNavigationProp = NativeStackNavigationProp<
  SettingsStackParamList,
  'SettingsHome'
>;

/**
 * Every canvas export now asks for SVG or PNG in its own chooser, so the global default is hidden.
 * The setting itself (store, database column, sync) is untouched: flip this to bring the row back.
 */
const SHOW_EXPORT_FORMAT_SETTING = false;

const SettingsScreen = () => {
  useBackButtonHandler();
  const { t } = useTranslation();
  useScreenHeader({ target: 'parent', title: t('settings_title') });
  const { colors } = useTheme();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const { isCompact } = useResponsiveLayout();
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
    exportFormat,
    showTutorials,
    warnPaymentDue,
    setUsername,
    setLanguage,
    setUse24HourTime,
    setDateDisplayFormat,
    setShowContextualHelp,
    setSuggestLiteraryDevices,
    setExportFormat,
    setShowTutorials,
    setWarnPaymentDue,
    resetSeenTutorials,
    resetSettings,
  } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();
  const { darkMode, setDarkMode, resetTheme } = useThemeStore();

  // What is typed is kept apart from what is saved: the name is saved as it becomes valid, and the
  // field can pass through empty while it is being rewritten without ever saving that.
  const [usernameDraft, setUsernameDraft] = useState<string | null>(null);
  const usernameInvalid = usernameDraft !== null && normalizeLocalUsername(usernameDraft) === null;
  const handleUsernameChange = (newUsername: string) => {
    setUsernameDraft(newUsername);
    const name = normalizeLocalUsername(newUsername);
    if (name) void setUsername(drizzleClient, name);
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

  const handleExportFormatChange = (value: string | null) => {
    if (value === 'svg' || value === 'png') {
      setExportFormat(drizzleClient, value as MapExportFormat);
    }
  };

  const handleContextualHelpToggle = (value: boolean) => {
    setShowContextualHelp(drizzleClient, value);
  };

  const handleShowTutorialsToggle = (value: boolean) => {
    setShowTutorials(drizzleClient, value);
  };

  const handleWarnPaymentDueToggle = (value: boolean) => {
    setWarnPaymentDue(drizzleClient, value);
  };

  // The downloadable CJK serif for PDF exports: app-private fonts dir on
  // native (in memory on web), managed here instead of hiding inside the
  // export flow.
  const [cjkPack, setCjkPack] = useState<'missing' | 'ready' | 'working'>('missing');
  useEffect(() => {
    cjkPackState().then((state) => setCjkPack(state));
  }, []);

  const handleCjkInstall = async () => {
    setCjkPack('working');
    showNotification(t('export_manuscript_cjk_downloading', { size: CJK_PACK_SIZE_LABEL }), 'info');
    try {
      await downloadCjkPack();
      setCjkPack('ready');
      showNotification(t('export_manuscript_cjk_ready'), 'success');
    } catch (error) {
      setCjkPack('missing');
      showNotification(
        t('export_manuscript_cjk_failed', {
          reason: (error as Error)?.message ?? 'unknown error',
        }),
        'error',
      );
    }
  };

  const handleCjkDelete = () => {
    AppAlert.alert(t('settings_cjk_delete_title'), t('settings_cjk_delete_message'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('settings_cjk_delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteCjkPack();
          setCjkPack('missing');
          showNotification(t('settings_cjk_deleted'), 'success');
        },
      },
    ]);
  };

  const handleResetSeenTutorials = async () => {
    await resetSeenTutorials(drizzleClient);
    useGuideStore.getState().reset();
    showNotification(t('tutorials_reset_success'), 'success');
  };

  const musicTools = useMusicToolsStore((state) => state.enabled);
  const setMusicTools = useMusicToolsStore((state) => state.setEnabled);

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
              await Promise.all([realtimeShutdown, syncEngine.reset()]);
              await authTokenManager.clearAllAuth(serverIds);
              setAuthDb(null);
              setEditorDraftDb(null);
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
  const shownName = usernameDraft ?? (username || 'Keres User');
  const initial = (normalizeLocalUsername(shownName) ?? username ?? 'K').charAt(0).toUpperCase();

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.settings}>
        <View style={styles.hero}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarLetter, { color: colors.onPrimary }]}>{initial}</Text>
          </View>
        </View>

        <View style={[styles.columns, !isCompact && styles.columnsSideBySide]}>
          <View style={!isCompact && styles.columnSideBySide}>
            <SettingsGroup title={t('settings_section_profile')}>
              <SettingsRow
                icon="person-outline"
                label={t('username')}
                below={
                  <>
                    <TextInput
                      value={shownName}
                      onChangeText={handleUsernameChange}
                      onBlur={() => setUsernameDraft(null)}
                      placeholder={t('enter_username')}
                      style={[commonInputStyles.input, styles.input]}
                    />
                    {usernameInvalid && (
                      <Text style={[styles.usernameError, { color: colors.error }]}>
                        {t('username_required_error')}
                      </Text>
                    )}
                  </>
                }
              />
            </SettingsGroup>

            <SettingsGroup title={t('settings_section_appearance')}>
              <SettingsRow
                icon="language-outline"
                label={t('select_language')}
                below={
                  <View style={styles.select}>
                    <SingleSelectPill
                      options={languageOptions}
                      value={language || 'en'}
                      onValueChange={handleLanguageChange as (value: string | null) => void}
                      placeholder={t('select_language')}
                    />
                  </View>
                }
              />
              <SettingsRow
                icon="moon-outline"
                label={t('dark_mode')}
                control={<ThemedSwitch value={darkMode} onValueChange={handleDarkModeToggle} />}
              />
              <SettingsRow
                icon="time-outline"
                label={t('use_24_hour_time')}
                hint={use24HourTime ? t('use_24_hour_time_on') : t('use_24_hour_time_off')}
                control={
                  <ThemedSwitch value={use24HourTime} onValueChange={handleTimeFormatToggle} />
                }
              />
              <SettingsRow
                icon="calendar-outline"
                label={t('date_display_format')}
                hint={t('date_display_format_hint')}
                below={
                  <View style={styles.select}>
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
                }
              />
              {SHOW_EXPORT_FORMAT_SETTING && (
                <SettingsRow
                  icon="image-outline"
                  label={t('export_format')}
                  hint={t('export_format_hint')}
                  below={
                    <View style={styles.select}>
                      <SingleSelectPill
                        options={[
                          { label: t('export_format_svg'), value: 'svg' },
                          { label: t('export_format_png'), value: 'png' },
                        ]}
                        value={exportFormat}
                        onValueChange={handleExportFormatChange}
                        placeholder={t('export_format')}
                      />
                    </View>
                  }
                />
              )}
            </SettingsGroup>
          </View>
          <View style={!isCompact && styles.columnSideBySide}>
            <SettingsGroup title={t('settings_section_assistance')}>
              <SettingsRow
                icon="bulb-outline"
                label={t('suggest_literary_devices')}
                hint={
                  suggestLiteraryDevices
                    ? t('suggest_literary_devices_on')
                    : t('suggest_literary_devices_off')
                }
                control={
                  <ThemedSwitch
                    value={suggestLiteraryDevices}
                    onValueChange={handleLiteraryDevicesToggle}
                  />
                }
              />
              <SettingsRow
                icon="musical-notes-outline"
                label={t('music_tools')}
                hint={musicTools ? t('music_tools_on') : t('music_tools_off')}
                control={<ThemedSwitch value={musicTools} onValueChange={setMusicTools} />}
              />
              <SettingsRow
                icon="help-circle-outline"
                label={t('show_contextual_help')}
                hint={
                  showContextualHelp ? t('show_contextual_help_on') : t('show_contextual_help_off')
                }
                control={
                  <ThemedSwitch
                    value={showContextualHelp}
                    onValueChange={handleContextualHelpToggle}
                  />
                }
              />
              <SettingsRow
                icon="school-outline"
                label={t('show_tutorials')}
                hint={showTutorials ? t('show_tutorials_on') : t('show_tutorials_off')}
                control={
                  <ThemedSwitch value={showTutorials} onValueChange={handleShowTutorialsToggle} />
                }
              />
              <SettingsRow
                icon="card-outline"
                label={t('warn_payment_due')}
                hint={warnPaymentDue ? t('warn_payment_due_on') : t('warn_payment_due_off')}
                control={
                  <ThemedSwitch value={warnPaymentDue} onValueChange={handleWarnPaymentDueToggle} />
                }
              />
            </SettingsGroup>

            <SettingsGroup title={t('settings_section_exports')}>
              <SettingsRow
                icon="text-outline"
                label={t('settings_cjk_title')}
                hint={
                  cjkPack === 'ready'
                    ? t('settings_cjk_installed', { size: CJK_PACK_SIZE_LABEL })
                    : t('settings_cjk_missing')
                }
                control={
                  cjkPack === 'ready' ? (
                    <Button onPress={handleCjkDelete}>{t('settings_cjk_delete')}</Button>
                  ) : (
                    <Button onPress={handleCjkInstall} disabled={cjkPack === 'working'}>
                      {t('settings_cjk_install')}
                    </Button>
                  )
                }
              />
            </SettingsGroup>

            <SettingsGroup title={t('settings_section_data')}>
              <SettingsRow
                icon="refresh-outline"
                label={t('reset_seen_tutorials')}
                hint={t('settings_reset_tutorials_hint')}
                onPress={handleResetSeenTutorials}
              />
              <SettingsRow
                icon="trash-outline"
                label={t('reset_application')}
                hint={t('settings_reset_application_hint')}
                destructive
                onPress={handleResetApplication}
              />
            </SettingsGroup>
          </View>
        </View>
      </View>

      <View style={styles.branding}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Credits')}
          accessibilityLabel={t('credits_open_credits')}
          accessibilityRole="button"
        >
          <Image
            source={require('../../../assets/images/desktop_icon_512.png')}
            style={[styles.brandImage, { height: brandImageSize, width: brandImageSize }]}
            resizeMode="contain"
            accessibilityLabel="Keres"
          />
        </TouchableOpacity>
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
    width: '100%',
  },
  // One column on a phone; from a tablet up two, filled top to bottom, across the whole width like every
  // other screen.
  columns: { flexDirection: 'column' },
  columnsSideBySide: { alignItems: 'flex-start', flexDirection: 'row', gap: 20 },
  columnSideBySide: { flexBasis: 0, flexGrow: 1, flexShrink: 1 },
  hero: { alignItems: 'center', paddingTop: 8 },
  avatar: {
    alignItems: 'center',
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarLetter: { fontSize: 32, fontWeight: '700' },
  select: { height: 50 },
  input: { marginBottom: 0 },
  usernameError: { fontSize: 13, marginTop: 4 },
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
