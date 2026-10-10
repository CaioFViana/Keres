import { Button, ThemePickerModal } from '@/src/components/common';
import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import GalleryCoverField from '@/src/components/features/gallery/GalleryCoverField';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { themeDisplayOptions } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useStoryRole } from '../../hooks/useStoryRole';
import { createStoryService } from '../../services/storymanagement/StoryService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { AppAlert } from '../../utils/AppAlert';
import ThemePreview from './ThemePreview';
import { useLoadedStory } from './useLoadedStory';
import { useStorySettingsSave } from './useStorySettingsSave';
import ThemedText from '@/src/components/common/display/ThemedText/ThemedText';

/**
 * How the story looks: its cover, which saves with the button, and its theme, which saves as it is confirmed in
 * the picker (a theme is tried on live first, so it has no draft to keep).
 */
const StorySettingsAppearanceScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors, setTheme: applyTheme } = useTheme();
  const navigation = useNavigation();
  const drizzleDb = useDrizzle();
  const storyService = useMemo(() => createStoryService(drizzleDb), [drizzleDb]);
  const { selectedStory, setSelectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const storyId = selectedStory?.id;
  const { canEdit } = useStoryRole(storyId);
  const { saving, save } = useStorySettingsSave();
  const [coverGalleryId, setCoverGalleryId] = useState<string | null>(null);
  const [themeName, setThemeName] = useState(selectedStory?.theme || 'default');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);

  const [prevStoryId, setPrevStoryId] = useState(selectedStory?.id);
  const [prevTheme, setPrevTheme] = useState(selectedStory?.theme);
  if (selectedStory?.id !== prevStoryId || selectedStory?.theme !== prevTheme) {
    setPrevStoryId(selectedStory?.id);
    setPrevTheme(selectedStory?.theme);
    setThemeName(selectedStory?.theme || 'default');
  }

  useScreenHeader({ target: 'parent', title: t('appearance_title') });

  const { loading, error } = useLoadedStory(
    useCallback((story) => setCoverGalleryId(story.coverGalleryId ?? null), []),
  );

  const handleClosePicker = useCallback(() => {
    applyTheme(themeName);
    setPickerVisible(false);
  }, [applyTheme, themeName]);

  const handleConfirmTheme = useCallback(
    async (nextThemeName: string) => {
      if (!storyId || !userId || !selectedStory) return;
      setThemeSaving(true);
      try {
        // Keep null as the storage representation of the application's default palette.
        const storedTheme = nextThemeName === 'default' ? null : nextThemeName;
        await storyService.updateStory(userId, storyId, { theme: storedTheme });
        setSelectedStory({ ...selectedStory, theme: storedTheme });
        setThemeName(nextThemeName);
        applyTheme(nextThemeName);
        setPickerVisible(false);
        AppAlert.alert(t('success'), t('theme_updated_successfully'));
      } catch {
        applyTheme(themeName);
        AppAlert.alert(t('error'), t('failed_to_update_theme'));
      } finally {
        setThemeSaving(false);
      }
    },
    [applyTheme, selectedStory, setSelectedStory, storyId, storyService, t, themeName, userId],
  );

  const themeLabel = t(
    themeDisplayOptions.find((option) => option.value === themeName)?.labelKey ||
      'theme_default_label',
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
        card: {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: 10,
          borderWidth: 1,
          marginBottom: 16,
          marginTop: 20,
          padding: 16,
        },
        cardHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
        cardTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' },
        value: { color: colors.textSecondary, lineHeight: 19, marginTop: 8 },
        action: { marginTop: 16 },
      }),
    [colors],
  );

  if (!storyId) {
    return (
      <ScreenError
        message={t('no_story_selected_for_settings')}
        onGoBack={() => navigation.goBack()}
      />
    );
  }
  if (loading) return <ScreenLoading />;
  if (error) return <ScreenError message={error} onGoBack={() => navigation.goBack()} />;

  return (
    <EntityFormContainer
      planUsage={false}
      title={t('appearance_title')}
      description={t('story_settings_section_appearance_description')}
      actions={
        <Button onPress={() => void save({ coverGalleryId })} disabled={!canEdit || saving}>
          {t('update_story')}
        </Button>
      }
    >
      {!canEdit && (
        <ThemedText tone="secondary" style={{ marginBottom: 15 }}>
          {t('story_read_only_error')}
        </ThemedText>
      )}
      <Text style={styles.label}>{t('cover')}</Text>
      <GalleryCoverField
        storyId={storyId}
        value={coverGalleryId}
        onChange={setCoverGalleryId}
        editable={canEdit}
      />

      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <Ionicons name="color-palette-outline" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>{t('theme')}</Text>
        </View>
        <Text style={styles.value}>{themeLabel}</Text>
        {canEdit ? (
          <Button onPress={() => setPickerVisible(true)} style={styles.action}>
            {t('select_theme')}
          </Button>
        ) : null}
      </View>
      <ThemePreview />
      <ThemePickerModal
        visible={pickerVisible}
        value={themeName}
        onPreview={applyTheme}
        onConfirm={handleConfirmTheme}
        onClose={handleClosePicker}
        saving={themeSaving}
      />
    </EntityFormContainer>
  );
};

export default StorySettingsAppearanceScreen;
