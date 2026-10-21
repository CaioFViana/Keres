import {
  PROFILE_BIOGRAPHY_MAX_LENGTH,
  PROFILE_LINK_LABEL_MAX_LENGTH,
  PROFILE_LINK_URL_MAX_LENGTH,
  PROFILE_LINKS_MAX,
  themeDisplayOptions,
} from '@keres/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Button from '@/src/components/common/controls/Button/Button';
import FormField from '@/src/components/common/forms/FormField/FormField';
import ThemePickerModal from '@/src/components/common/inputs/ThemePickerModal/ThemePickerModal';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '@/src/db';
import type { ServerSelect } from '@/src/db/schema';
import { useFormScrollBottomPadding } from '@/src/hooks/forms/useFormScrollBottomPadding';
import { useBackButtonHandler } from '@/src/hooks/nav/useBackButtonHandler';
import { useScreenHeader } from '@/src/hooks/nav/useScreenHeader';
import type { ServerManagementStackParamList } from '@/src/navigation/stacks/StorySelectionStack';
import { isOfflineError } from '@/src/services/api/apiClient';
import { publicationApiService } from '@/src/services/api/PublicationApiService';
import { userApiService } from '@/src/services/api/UserApiService';
import { createServerService } from '@/src/services/servers/ServerService';
import { AppAlert } from '@/src/state/ui/AppAlert';
import { type ThemeColors, useTheme } from '@/src/theme';
import { getCommonContainerStyles, getCommonInputStyles } from '@/src/theme/commonStyles';
import { space, typography } from '@/src/theme/tokens';
import { useThemedStyles } from '@/src/theme/useThemedStyles';
import { cleanLinkDrafts, type LinkDraft, type LinkProblem } from '@/src/utils/format/profileLinks';
import { buildAuthorPublicUrl } from '@/src/utils/format/showcaseUrls';
import { logger } from '@/src/utils/logging/logger';

type PublicProfileRouteProp = RouteProp<ServerManagementStackParamList, 'PublicProfile'>;
type PublicProfileNavigationProp = NativeStackNavigationProp<
  ServerManagementStackParamList,
  'PublicProfile'
>;

const EMPTY_LINK: LinkDraft = { label: '', url: '' };

/**
 * What the user writes for their author page on a server's public showcase: a longer biography than the bio friends
 * see, links to wherever else their work or plans live, and the palette the page wears. Nothing here is shown until
 * the user has published a story on that server, and every text is theirs to clear.
 */
const PublicProfileScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<PublicProfileNavigationProp>();
  const route = useRoute<PublicProfileRouteProp>();
  const { serverId } = route.params;
  const drizzleDb = useDrizzle();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonInputStyles = getCommonInputStyles(colors);

  const [server, setServer] = useState<ServerSelect | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showcaseEnabled, setShowcaseEnabled] = useState<boolean | undefined>(undefined);
  const [biography, setBiography] = useState('');
  const [links, setLinks] = useState<LinkDraft[]>([]);
  const [theme, setTheme] = useState<string | null>(null);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [problem, setProblem] = useState<LinkProblem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const fetchedServer = await createServerService(drizzleDb).getServerById(serverId);
        if (!fetchedServer) {
          if (!cancelled) setError(t('server_not_found'));
          return;
        }
        if (cancelled) return;
        setServer(fetchedServer);

        const [profile, own, enabled] = await Promise.all([
          userApiService.getPublicProfile(fetchedServer),
          userApiService.getOwnProfile(fetchedServer),
          publicationApiService.isShowcaseEnabled(fetchedServer),
        ]);
        if (cancelled) return;
        setBiography(profile?.biography ?? '');
        setLinks((profile?.links ?? []).map((link) => ({ ...link })));
        setTheme(profile?.theme ?? null);
        setUsername(own?.username ?? null);
        setShowcaseEnabled(enabled);
      } catch (err) {
        if (!cancelled) {
          logger.error('Failed to load the author page texts:', err);
          setError(isOfflineError(err) ? t('server_unreachable') : t('author_page_load_failed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drizzleDb, serverId, t]);

  useScreenHeader({ target: 'parent', title: t('author_page_title') });

  const changeLink = (index: number, patch: Partial<LinkDraft>) => {
    setProblem(null);
    setLinks((current) => current.map((link, at) => (at === index ? { ...link, ...patch } : link)));
  };

  const handleSave = async () => {
    if (!server) return;
    const cleaned = cleanLinkDrafts(links);
    if (cleaned.problem) {
      setProblem(cleaned.problem);
      AppAlert.alert(t('error'), t('author_page_invalid_link'));
      return;
    }
    setSaving(true);
    try {
      await userApiService.updatePublicProfile(server, {
        biography: biography.trim() || null,
        links: cleaned.links,
        theme,
      });
      AppAlert.alert(t('success'), t('author_page_saved'));
      navigation.goBack();
    } catch (err) {
      logger.error('Failed to update the author page texts:', err);
      AppAlert.alert(
        t('error'),
        isOfflineError(err) ? t('server_unreachable') : t('author_page_save_failed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const styles = useThemedStyles(createStyles, [scrollBottomPadding]);

  if (loading) {
    return <ScreenLoading message={t('loading')} />;
  }

  if (error || !server) {
    return (
      <ScreenError message={error || t('server_not_found')} onGoBack={() => navigation.goBack()} />
    );
  }

  const themeLabel = theme
    ? t(
        themeDisplayOptions.find((option) => option.value === theme)?.labelKey ??
          'theme_default_label',
      )
    : t('author_page_theme_site');

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={styles.scrollViewContent}
    >
      <Text style={styles.intro}>{t('author_page_intro')}</Text>
      {showcaseEnabled === false ? (
        <Text style={styles.warning}>{t('author_page_showcase_off')}</Text>
      ) : null}

      <FormField label={t('author_page_biography')} help={t('author_page_biography_hint')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('author_page_biography_placeholder')}
            value={biography}
            onChangeText={(text) => setBiography(text.slice(0, PROFILE_BIOGRAPHY_MAX_LENGTH))}
            style={[commonInputStyles.multiline, styles.biographyInput]}
            multiline
            maxLength={PROFILE_BIOGRAPHY_MAX_LENGTH}
            testID="author-page-biography"
          />
        )}
      </FormField>
      <Text style={styles.charCount}>
        {biography.length}/{PROFILE_BIOGRAPHY_MAX_LENGTH}
      </Text>

      <Text style={styles.sectionTitle}>{t('author_page_links')}</Text>
      <Text style={styles.hint}>{t('author_page_links_hint', { count: PROFILE_LINKS_MAX })}</Text>
      {links.map((link, index) => (
        // Rows have no identity of their own: they are typed, reordered by nothing and removed by position.
        <View key={index} style={styles.linkRow} testID={`author-page-link-${index}`}>
          <FormField
            label={t('author_page_link_label')}
            error={
              problem?.index === index && problem.field === 'label'
                ? t('author_page_link_label_missing')
                : undefined
            }
          >
            {(fieldAccessibility) => (
              <TextInput
                {...fieldAccessibility}
                placeholder={t('author_page_link_label_placeholder')}
                value={link.label}
                onChangeText={(text) =>
                  changeLink(index, { label: text.slice(0, PROFILE_LINK_LABEL_MAX_LENGTH) })
                }
                maxLength={PROFILE_LINK_LABEL_MAX_LENGTH}
                testID={`author-page-link-label-${index}`}
              />
            )}
          </FormField>
          <FormField
            label={t('author_page_link_url')}
            error={
              problem?.index === index && problem.field === 'url'
                ? t('author_page_link_url_invalid')
                : undefined
            }
          >
            {(fieldAccessibility) => (
              <TextInput
                {...fieldAccessibility}
                placeholder="https://"
                value={link.url}
                onChangeText={(text) =>
                  changeLink(index, { url: text.slice(0, PROFILE_LINK_URL_MAX_LENGTH) })
                }
                maxLength={PROFILE_LINK_URL_MAX_LENGTH}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                testID={`author-page-link-url-${index}`}
              />
            )}
          </FormField>
          <Button
            variant="danger"
            icon="trash-outline"
            onPress={() => {
              setProblem(null);
              setLinks((current) => current.filter((_, at) => at !== index));
            }}
            style={styles.removeLink}
            testID={`author-page-link-remove-${index}`}
          >
            {t('author_page_remove_link')}
          </Button>
        </View>
      ))}
      <Button
        variant="secondary"
        icon="add-outline"
        onPress={() => setLinks((current) => [...current, { ...EMPTY_LINK }])}
        disabled={links.length >= PROFILE_LINKS_MAX}
        style={styles.addLink}
        testID="author-page-add-link"
      >
        {t('author_page_add_link')}
      </Button>

      <Text style={styles.sectionTitle}>{t('author_page_theme')}</Text>
      <Text style={styles.hint}>{t('author_page_theme_hint')}</Text>
      <Text style={styles.themeValue} testID="author-page-theme-value">
        {themeLabel}
      </Text>
      <View style={styles.themeActions}>
        <Button
          variant="secondary"
          onPress={() => setThemePickerOpen(true)}
          testID="author-page-theme-select"
        >
          {t('select_theme')}
        </Button>
        {theme ? (
          <Button
            variant="secondary"
            onPress={() => setTheme(null)}
            testID="author-page-theme-clear"
          >
            {t('author_page_theme_clear')}
          </Button>
        ) : null}
      </View>
      {/* Trying a palette here must not repaint the app: the page wears it, not this screen. */}
      <ThemePickerModal
        visible={themePickerOpen}
        value={theme}
        onPreview={() => {}}
        onConfirm={(name) => {
          setTheme(name);
          setThemePickerOpen(false);
        }}
        onClose={() => setThemePickerOpen(false)}
      />

      <Button
        onPress={handleSave}
        style={styles.saveButton}
        disabled={saving}
        testID="author-page-save"
      >
        {saving ? t('saving') : t('save')}
      </Button>
      {showcaseEnabled && username ? (
        <Button
          variant="secondary"
          icon="open-outline"
          onPress={() => void Linking.openURL(buildAuthorPublicUrl(server.url, username))}
          style={styles.viewPage}
          testID="author-page-view"
        >
          {t('author_page_view')}
        </Button>
      ) : null}
    </KeyboardAwareScreen>
  );
};

const createStyles = (colors: ThemeColors, [scrollBottomPadding]: [number]) =>
  StyleSheet.create({
    scrollViewContent: { padding: space.xxl, paddingBottom: scrollBottomPadding, flexGrow: 1 },
    intro: { ...typography.body, color: colors.textSecondary, marginBottom: space.md },
    warning: { ...typography.body, color: colors.error, marginBottom: space.md },
    biographyInput: { minHeight: 6 * 20, textAlignVertical: 'top' },
    charCount: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'right',
      marginTop: -space.xxs,
      marginBottom: space.lg,
    },
    sectionTitle: {
      ...typography.sectionTitle,
      color: colors.text,
      marginTop: space.xl,
      marginBottom: space.xs,
    },
    hint: { ...typography.hint, color: colors.textSecondary, marginBottom: space.md },
    linkRow: {
      borderColor: colors.border,
      borderRadius: space.md,
      borderWidth: 1,
      marginBottom: space.lg,
      padding: space.lg,
    },
    removeLink: { marginTop: space.lg },
    addLink: { marginTop: space.xs },
    themeValue: { ...typography.bodyLarge, color: colors.text, marginBottom: space.md },
    themeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
    saveButton: { marginTop: space.xxxl },
    viewPage: { marginTop: space.lg },
  });

export default PublicProfileScreen;
