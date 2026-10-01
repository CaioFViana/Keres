import { Button, TextInput } from '@/src/components/common';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { KERES_LATEST_RELEASE_URL } from '@keres/shared';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import WelcomePageView from '../../components/features/welcome/WelcomePageView';
import WelcomeLanguagePicker from '../../components/features/welcome/WelcomeLanguagePicker';
import WelcomePager, { useWelcomePager } from '../../components/features/welcome/WelcomePager';
import WelcomeProgress from '../../components/features/welcome/WelcomeProgress';
import { offersOfficialApp, WELCOME_PAGES } from '../../components/features/welcome/welcomeContent';
import { useDrizzle } from '../../db';
import { useFormScrollBottomPadding } from '../../hooks/useFormScrollBottomPadding';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { migrate } from '../../db/migrate';
import { setAuthDb } from '../../services/AuthTokenManager';
import { setEditorDraftDb } from '../../services/EditorDraftService';
import { createClientSettings } from '../../services/ClientSettingsService';
import { syncEngine } from '../../services/sync/appSyncEngine';
import { useNotificationStore } from '../../state/notificationStore';
import { useThemeStore } from '../../state/themeStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { getClientFlavor } from '../../utils/clientFlavor';
import { useDocumentTitle } from '../../utils/documentTitle';
import i18n, { getLanguageOptions } from '../../utils/i18n';
import { normalizeLocalUsername } from '../../utils/localUsername';

type RootStackParamList = {
  ColdInstall: undefined;
  StorySelection: undefined;
  MainSystem: undefined;
};

/** How wide the welcome may get: a column on a phone, room for the picture beside the text on more. */
const STACKED_MAX_WIDTH = 560;
const SPLIT_MAX_WIDTH = 1040;

type ColdInstallScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ColdInstall'>;

/**
 * The first thing anyone sees: a short welcome - what Keres is, where what they make lives (which
 * depends on the build, see `welcomeRows`) - ending on the form that creates the local profile. It is
 * not a guided tour: those need the settings row this screen is about to create, and there is
 * nothing to remember afterwards - it shows whenever there is no profile yet.
 */
/** The language the app is showing now, when it is one of the offered ones; English otherwise. */
const initialLanguage = (): string => {
  const current = (i18n.language ?? 'en').split('-')[0];
  return current === 'pt' ? 'pt' : 'en';
};

const ColdInstallScreen = () => {
  const [page, setPage] = useState(0);
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const { t } = useTranslation();
  useDocumentTitle(t('welcome'));
  const navigation = useNavigation<ColdInstallScreenNavigationProp>();
  const { colors } = useTheme();
  // Starts on the language the app is already showing, so there is never a step left undone: with none
  // chosen, the way forward stayed disabled with nothing on screen saying why.
  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialLanguage);
  const { showNotification } = useNotificationStore();

  const db = useSQLiteContext();
  const drizzleDb = useDrizzle();

  const initializeUserSettings = useUserSettingsStore((state) => state.initializeSettings);
  const initializeThemeSettings = useThemeStore((state) => state.initializeTheme);
  // Chosen here, shown at once, and saved with the profile: there is no settings row to write to yet.
  const darkMode = useThemeStore((state) => state.darkMode);
  const previewDarkMode = useThemeStore((state) => state.previewDarkMode);

  const commonInputStyles = getCommonInputStyles(colors);

  const backPressTimer = useRef<number | null>(null);
  const flavor = getClientFlavor();
  // From a tablet up the picture sits beside the text instead of over it, and the welcome gets the
  // room for that: one design for a phone held upright is not what a desktop window should show.
  const { width: windowWidth, isCompact } = useResponsiveLayout();
  const layout = isCompact ? 'stacked' : 'split';
  const pageWidth = Math.min(windowWidth - 40, isCompact ? STACKED_MAX_WIDTH : SPLIT_MAX_WIDTH);
  const insets = useSafeAreaInsets();
  const footerBottom = useFormScrollBottomPadding(12);
  const [scrollX, scrollRef, onScroll] = useWelcomePager({
    page,
    pageWidth,
    onPageChange: setPage,
  });
  const lastPage = WELCOME_PAGES.length - 1;
  const trimmedUsername = normalizeLocalUsername(username) ?? '';

  useEffect(() => {
    // The web build has no hardware back button; registering only logs
    // "BackHandler is not supported on web" noise.
    if (Platform.OS === 'web') {
      return;
    }

    const backAction = () => {
      // Inside the welcome, back goes to the step before; only from the first one does it leave.
      if (page > 0) {
        setPage(page - 1);
        return true;
      }
      if (backPressTimer.current && Date.now() - backPressTimer.current < 2000) {
        BackHandler.exitApp();
        return true; // Event handled
      } else {
        backPressTimer.current = Date.now();
        showNotification(t('press_back_again_to_exit'), 'info');
        return true; // Event handled, but don't exit yet
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [t, showNotification, page]);

  const handleProceed = async () => {
    let isValid = true;

    // The name is only how the app addresses the person on this device: nothing bounds it but being
    // there (the column is NOT NULL text, and no schema limits it).
    if (trimmedUsername.length === 0) {
      setUsernameError(t('username_required_error'));
      isValid = false;
    } else {
      setUsernameError(null);
    }

    if (!isValid) {
      return;
    }

    // Run database migrations first
    await migrate(db);

    // A full reset deliberately detaches these services while the old account is being
    // erased. Reattach them as soon as the fresh schema exists, before server registration
    // can attempt to persist tokens or start its first synchronization.
    setAuthDb(drizzleDb);
    setEditorDraftDb(drizzleDb);
    await syncEngine.bindDatabase(drizzleDb);

    // Create initial client settings in SQLite
    await createClientSettings(drizzleDb, {
      localUsername: trimmedUsername,
      language: selectedLanguage,
      darkMode,
      use24HourTime: true, // Default to 24-hour clock
      dateDisplayFormat: 'iso',
      showContextualHelp: true,
      suggestLiteraryDevices: true,
      showTutorials: true,
    });

    // Initialize stores with the newly created settings
    await initializeUserSettings(drizzleDb);
    await initializeThemeSettings(drizzleDb);

    navigation.replace('StorySelection');
  };

  const handleLanguageChange = (itemValue: string | null) => {
    // Choosing nothing is not an option here: the language already shown stays.
    if (!itemValue) return;
    setSelectedLanguage(itemValue);
    i18n.changeLanguage(itemValue);
    // No need to call setStoreLanguage here, as it will be set during handleProceed
  };

  const isProceedDisabled = trimmedUsername.length === 0;

  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    errorText: { color: colors.error, marginTop: 6 },
    bar: { width: '100%', alignItems: 'center', paddingTop: insets.top + 12, paddingBottom: 8 },
    barInner: {
      width: pageWidth,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    barActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    skip: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', padding: 8 },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    footer: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: footerBottom },
    footerInner: isCompact
      ? { width: pageWidth, alignItems: 'center' as const }
      : {
          width: pageWidth,
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'space-between' as const,
        },
    footerSide: { width: 180, alignItems: 'flex-start' as const },
    primaryAction: isCompact
      ? { width: '100%' as const, paddingVertical: 15, borderRadius: 14 }
      : { minWidth: 200, paddingVertical: 14, borderRadius: 14 },
    back: { color: colors.primary, fontSize: 16, fontWeight: '600', padding: 10 },
    appLinkRow: { width: pageWidth, alignItems: 'flex-end', paddingTop: 10 },
    appLink: { color: colors.textSecondary, fontSize: 13, textDecorationLine: 'underline' },
  });

  const languageOptions = getLanguageOptions(t);

  const onLastPage = page === lastPage;

  const back = page > 0 && (
    <TouchableOpacity
      onPress={() => setPage(page - 1)}
      accessibilityRole="button"
      testID="welcome-back"
    >
      <Text style={styles.back}>{t('welcome_back')}</Text>
    </TouchableOpacity>
  );
  const action = onLastPage ? (
    <Button onPress={handleProceed} disabled={isProceedDisabled} style={styles.primaryAction}>
      {t('proceed')}
    </Button>
  ) : (
    <Button onPress={() => setPage(page + 1)} style={styles.primaryAction} testID="welcome-next">
      {t('welcome_next')}
    </Button>
  );
  const progress = (
    <WelcomeProgress
      current={page}
      total={WELCOME_PAGES.length}
      scrollX={scrollX}
      pageWidth={pageWidth}
      onSelect={setPage}
    />
  );

  // The language and the way out stay put at the top, and the way forward at the bottom: they are
  // the same on every step, so they do not travel with the pages.
  const footer = (
    <View style={styles.footer}>
      <View style={styles.footerInner}>
        {isCompact ? (
          <>
            {progress}
            <View style={{ height: 18 }} />
            {action}
            {back}
          </>
        ) : (
          <>
            <View style={styles.footerSide}>{back}</View>
            {progress}
            <View style={[styles.footerSide, { alignItems: 'flex-end' }]}>{action}</View>
          </>
        )}
      </View>
      {offersOfficialApp(flavor) && (
        <View style={styles.appLinkRow}>
          <Text
            style={styles.appLink}
            onPress={() => void Linking.openURL(KERES_LATEST_RELEASE_URL)}
            accessibilityRole="link"
            testID="welcome-official-app-link"
          >
            {t('welcome_get_app')}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.screen} testID={`welcome-screen-${layout}`}>
      <View style={styles.bar}>
        <View style={styles.barInner}>
          <WelcomeLanguagePicker
            options={languageOptions}
            value={selectedLanguage}
            onValueChange={handleLanguageChange}
            placeholder={t('select_language')}
          />
          <View style={styles.barActions}>
            <Ionicons
              name={darkMode ? 'moon' : 'sunny-outline'}
              size={18}
              color={colors.textSecondary}
            />
            <ThemedSwitch
              value={darkMode}
              onValueChange={previewDarkMode}
              accessibilityLabel={t('dark_mode')}
              testID="welcome-dark-mode"
            />
            {!onLastPage && (
              <TouchableOpacity
                onPress={() => setPage(lastPage)}
                accessibilityRole="button"
                testID="welcome-skip"
              >
                <Text style={styles.skip}>{t('welcome_skip')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <KeyboardAwareScreen
        contentContainerStyle={styles.scrollContent}
        keyboardVerticalOffset={insets.top + 64}
        footer={footer}
      >
        <WelcomePager scrollRef={scrollRef} onScroll={onScroll} pageWidth={pageWidth}>
          {WELCOME_PAGES.map((id, index) => (
            <WelcomePageView
              key={id}
              page={id}
              flavor={flavor}
              layout={layout}
              index={index}
              scrollX={scrollX}
              pageWidth={pageWidth}
              active={index === page}
              eyebrow={index === 0 ? t('welcome') : undefined}
            >
              {index === lastPage && (
                <>
                  <TextInput
                    placeholder={t('enter_username')}
                    value={username}
                    onChangeText={setUsername}
                    editable={onLastPage}
                    style={[commonInputStyles.input, { width: '100%', marginTop: 4 }]}
                  />
                  {usernameError && <Text style={styles.errorText}>{usernameError}</Text>}
                </>
              )}
            </WelcomePageView>
          ))}
        </WelcomePager>
      </KeyboardAwareScreen>
    </View>
  );
};

export default ColdInstallScreen;
