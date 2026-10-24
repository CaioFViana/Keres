import { Button, TextInput } from '@/src/components/common';
import ThemedSwitch from '@/src/components/common/controls/ThemedSwitch/ThemedSwitch';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { KERES_LATEST_RELEASE_URL } from '@keres/shared';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import TermsModal from '@/src/components/features/servers/TermsModal/TermsModal';
import {
  CLIENT_TERMS_UPDATED_AT,
  CLIENT_TERMS_VERSION,
  clientTermsFor,
} from '@/src/legal/clientTerms';
import {
  CLIENT_PRIVACY_UPDATED_AT,
  CLIENT_PRIVACY_VERSION,
  clientPrivacyFor,
} from '@/src/legal/privacyPolicy';
import { getAcceptedClientLegal, setAcceptedClientLegal } from '@/src/legal/clientTermsAcceptance';
import WelcomePageView from '@/src/components/features/welcome/WelcomePageView';
import WelcomeLanguagePicker from '@/src/components/features/welcome/WelcomeLanguagePicker';
import WelcomePager, { useWelcomePager } from '@/src/components/features/welcome/WelcomePager';
import WelcomeProgress from '@/src/components/features/welcome/WelcomeProgress';
import { offersOfficialApp, WELCOME_PAGES } from '@/src/components/features/welcome/welcomeContent';
import { useDrizzle } from '@/src/db';
import { useFormScrollBottomPadding } from '@/src/hooks/forms/useFormScrollBottomPadding';
import { useResponsiveLayout } from '@/src/hooks/ui/useResponsiveLayout';
import { migrate } from '@/src/db/migrate';
import { setAuthDb } from '@/src/services/auth/AuthTokenManager';
import { setEditorDraftDb } from '@/src/services/drafts/EditorDraftService';
import { createClientSettings } from '@/src/services/account/ClientSettingsService';
import { fetchAccountRequirement } from '@/src/services/api/AccountRequirementApiService';
import { hostedApiOrigin } from '@/src/services/auth/browserCookieSession';
import { syncEngine } from '@/src/services/sync/appSyncEngine';
import { useNotificationStore } from '@/src/state/ui/notificationStore';
import { useThemeStore } from '@/src/state/ui/themeStore';
import { useUserSettingsStore } from '@/src/state/app/userSettingsStore';
import { type ThemeColors, useTheme } from '@/src/theme';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { getClientFlavor, isHostedByApi } from '@/src/utils/platform/clientFlavor';
import { useDocumentTitle } from '@/src/utils/nav/documentTitle';
import i18n, { getLanguageOptions } from '@/src/utils/format/i18n';
import { normalizeLocalUsername } from '@/src/utils/auth/localUsername';
import { fireAndLog } from '@/src/utils/logging/fireAndLog';

type RootStackParamList = {
  ColdInstall: undefined;
  RequiredAccount: undefined;
  StorySelection: undefined;
  MainSystem: undefined;
};

/** How wide the welcome may get: a column on a phone, room for the picture beside the text on more. */
const STACKED_MAX_WIDTH = 560;
const SPLIT_MAX_WIDTH = 1040;

type ColdInstallScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ColdInstall'>;

/** The values the styles read: the top inset, the welcome's width, the footer's bottom padding, the compact flag. */
type Metrics = {
  insetTop: number;
  pageWidth: number;
  footerBottom: number;
  isCompact: boolean;
};

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
  const [termsVisible, setTermsVisible] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [acceptedTermsVersion, setAcceptedTermsVersion] = useState<number | null>(null);
  const [acceptedPrivacyVersion, setAcceptedPrivacyVersion] = useState<number | null>(null);
  // Whether the server that serves this client asks for an account once the welcome is done. Learned as
  // the welcome opens, so the last step can say so; an unreachable server, or any other build, asks nothing.
  const [accountRequired, setAccountRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAcceptedClientLegal('terms')
      .catch(() => null)
      .then((record) => {
        if (!cancelled) setAcceptedTermsVersion(record?.version ?? null);
      });
    void getAcceptedClientLegal('privacy')
      .catch(() => null)
      .then((record) => {
        if (!cancelled) setAcceptedPrivacyVersion(record?.version ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHostedByApi()) return;
    let cancelled = false;
    void fetchAccountRequirement(hostedApiOrigin()).then((required) => {
      if (!cancelled) setAccountRequired(required);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const termsAccepted = acceptedTermsVersion === CLIENT_TERMS_VERSION;
  const privacyAccepted = acceptedPrivacyVersion === CLIENT_PRIVACY_VERSION;
  const acceptTerms = () => {
    setAcceptedTermsVersion(CLIENT_TERMS_VERSION);
    setTermsVisible(false);
    void setAcceptedClientLegal('terms', CLIENT_TERMS_VERSION, 'onboarding');
  };
  const acceptPrivacy = () => {
    setAcceptedPrivacyVersion(CLIENT_PRIVACY_VERSION);
    setPrivacyVisible(false);
    void setAcceptedClientLegal('privacy', CLIENT_PRIVACY_VERSION, 'onboarding');
  };
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
  // The profile is created once: the server question at the end waits on the network, and a second tap meanwhile must not start over.
  const proceeding = useRef(false);
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

    if (!isValid || proceeding.current) {
      return;
    }
    proceeding.current = true;
    try {
      await createProfile();
    } catch (error) {
      proceeding.current = false;
      throw error;
    }
  };

  const createProfile = async () => {
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

    // The server that serves the hosted client may ask for an account before anything else. Only that
    // build asks (the apps never learn what a server wants at install), and an unreachable server asks nothing.
    // Asked again here when the welcome did not learn it: the answer may have changed while it was open.
    const required =
      accountRequired || (isHostedByApi() && (await fetchAccountRequirement(hostedApiOrigin())));
    navigation.replace(required ? 'RequiredAccount' : 'StorySelection');
  };

  const handleLanguageChange = (itemValue: string | null) => {
    // Choosing nothing is not an option here: the language already shown stays.
    if (!itemValue) return;
    setSelectedLanguage(itemValue);
    fireAndLog(i18n.changeLanguage(itemValue), 'changeLanguage');
    // No need to call setStoreLanguage here, as it will be set during handleProceed
  };

  // The terms and the privacy policy read from here, whenever the person opens them; the
  // server's own terms are what every account creation actually requires agreement to, at
  // registration. Forward stays shut until both are accepted: this is the app's clickwrap.
  const isProceedDisabled = trimmedUsername.length === 0 || !termsAccepted || !privacyAccepted;
  // The same three conditions, said out loud: a button that is shut with nothing on screen saying why
  // reads as broken. Each is named in the order the form asks for them.
  const missing = [
    ...(trimmedUsername.length === 0 ? [t('welcome_needs_name')] : []),
    ...(termsAccepted ? [] : [t('welcome_needs_terms')]),
    ...(privacyAccepted ? [] : [t('welcome_needs_privacy')]),
  ];

  const metrics = useMemo<Metrics>(
    () => ({ insetTop: insets.top, pageWidth, footerBottom, isCompact }),
    [insets.top, pageWidth, footerBottom, isCompact],
  );
  const styles = useThemedStyles(createStyles, [metrics]);

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
      {accountRequired ? t('welcome_next') : t('proceed')}
    </Button>
  ) : (
    <Button onPress={() => setPage(page + 1)} style={styles.primaryAction} testID="welcome-next">
      {t('welcome_next')}
    </Button>
  );
  const progress = (
    <WelcomeProgress
      current={page}
      // The account is one more step after these, on its own screen: counted, not reachable from here.
      total={WELCOME_PAGES.length + (accountRequired ? 1 : 0)}
      scrollX={scrollX}
      pageWidth={pageWidth}
      onSelect={(step) => {
        if (step <= lastPage) setPage(step);
      }}
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
              accountRequired={accountRequired}
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
                  <TouchableOpacity
                    onPress={() => setTermsVisible(true)}
                    accessibilityRole="button"
                    testID="welcome-terms-button"
                    style={styles.legalRow}
                  >
                    <Ionicons
                      name={termsAccepted ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={termsAccepted ? colors.primary : colors.textSecondary}
                    />
                    <Text style={styles.termsLink}>
                      {termsAccepted ? t('welcome_terms_accepted') : t('welcome_terms_read')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setPrivacyVisible(true)}
                    accessibilityRole="button"
                    testID="welcome-privacy-button"
                    style={styles.legalRow}
                  >
                    <Ionicons
                      name={privacyAccepted ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={privacyAccepted ? colors.primary : colors.textSecondary}
                    />
                    <Text style={styles.termsLink}>
                      {privacyAccepted ? t('welcome_privacy_accepted') : t('welcome_privacy_read')}
                    </Text>
                  </TouchableOpacity>
                  {isProceedDisabled && (
                    <View
                      style={styles.needs}
                      testID="welcome-proceed-hint"
                      accessibilityRole="alert"
                    >
                      <Text style={styles.needsIntro}>{t('welcome_needs_intro')}</Text>
                      {missing.map((item) => (
                        <Text key={item} style={styles.needsItem}>
                          {`• ${item}`}
                        </Text>
                      ))}
                    </View>
                  )}
                </>
              )}
            </WelcomePageView>
          ))}
        </WelcomePager>
      </KeyboardAwareScreen>
      <TermsModal
        visible={termsVisible}
        title={t('client_terms_title')}
        subtitle={t('client_terms_version', {
          version: CLIENT_TERMS_VERSION,
          date: CLIENT_TERMS_UPDATED_AT,
        })}
        sections={clientTermsFor(selectedLanguage)}
        mode="accept"
        acceptLabel={t('terms_accept')}
        onAccept={acceptTerms}
        onClose={() => setTermsVisible(false)}
        requireScrollToEnd
        testID="welcome-terms-modal"
      />
      <TermsModal
        visible={privacyVisible}
        title={t('client_privacy_title')}
        subtitle={t('client_privacy_version', {
          version: CLIENT_PRIVACY_VERSION,
          date: CLIENT_PRIVACY_UPDATED_AT,
        })}
        sections={clientPrivacyFor(selectedLanguage)}
        mode="accept"
        acceptLabel={t('terms_accept')}
        onAccept={acceptPrivacy}
        onClose={() => setPrivacyVisible(false)}
        requireScrollToEnd
        testID="welcome-privacy-modal"
      />
    </View>
  );
};

const createStyles = (colors: ThemeColors, [m]: [Metrics]) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    errorText: { color: colors.error, marginTop: 6 },
    bar: { width: '100%', alignItems: 'center', paddingTop: m.insetTop + 12, paddingBottom: 8 },
    barInner: {
      width: m.pageWidth,
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
    footer: {
      width: '100%',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: m.footerBottom,
    },
    footerInner: m.isCompact
      ? { width: m.pageWidth, alignItems: 'center' as const }
      : {
          width: m.pageWidth,
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          justifyContent: 'space-between' as const,
        },
    footerSide: { width: 180, alignItems: 'flex-start' as const },
    primaryAction: m.isCompact
      ? { width: '100%' as const, paddingVertical: 15, borderRadius: 14 }
      : { minWidth: 200, paddingVertical: 14, borderRadius: 14 },
    back: { color: colors.primary, fontSize: 16, fontWeight: '600', padding: 10 },
    legalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    termsLink: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    needs: {
      alignSelf: 'stretch',
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    needsIntro: { color: colors.text, fontSize: 13, fontWeight: '700', marginBottom: 2 },
    needsItem: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
    appLinkRow: { width: m.pageWidth, alignItems: 'flex-end', paddingTop: 10 },
    appLink: { color: colors.textSecondary, fontSize: 13, textDecorationLine: 'underline' },
  });

export default ColdInstallScreen;
