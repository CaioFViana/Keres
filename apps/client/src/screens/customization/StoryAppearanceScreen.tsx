import { Button, ThemePickerModal } from '@/src/components/common';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { createStoryService } from '@/src/services/storymanagement/StoryService';
import { useStoryStore } from '@/src/state/storyStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';
import { getCommonContainerStyles } from '@/src/theme/commonStyles';
import { setDocumentTitle } from '@/src/utils/documentTitle';
import { themeDisplayOptions } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useDrizzle } from '@/src/db';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import { AppAlert } from '@/src/utils/AppAlert';
import ThemePreview from './ThemePreview';

type AppearanceNavigation = NativeStackNavigationProp<
  CustomizationStackParamList,
  'StoryAppearance'
>;

/** Edits the Story-wide theme. Arc forms reuse ThemePickerModal for an optional override. */
const StoryAppearanceScreen = () => {
  // The drawer owns the visible header. Register its back action against this nested stack so the
  // header arrow returns to Customization instead of attempting to pop the drawer itself.
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors, setTheme: applyTheme } = useTheme();
  const navigation = useNavigation<AppearanceNavigation>();
  const drizzleDb = useDrizzle();
  const storyService = useMemo(() => createStoryService(drizzleDb), [drizzleDb]);
  const { selectedStory, setSelectedStory } = useStoryStore();
  const { userId } = useUserSettingsStore();
  const storyId = selectedStory?.id;
  const { canEdit } = useStoryRole(storyId);
  const scrollBottomPadding = useFormScrollBottomPadding();
  const [themeName, setThemeName] = useState(selectedStory?.theme || 'default');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setThemeName(selectedStory?.theme || 'default');
  }, [selectedStory?.id, selectedStory?.theme]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: t('appearance_title'), headerRight: undefined });
      setDocumentTitle(t('appearance_title'));
    }, [navigation, t]),
  );

  const handlePreview = useCallback(
    (nextThemeName: string) => applyTheme(nextThemeName),
    [applyTheme],
  );

  const handleClosePicker = useCallback(() => {
    applyTheme(themeName);
    setPickerVisible(false);
  }, [applyTheme, themeName]);

  const handleConfirmTheme = useCallback(
    async (nextThemeName: string) => {
      if (!storyId || !userId || !selectedStory) return;

      setSaving(true);
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
        setSaving(false);
      }
    },
    [applyTheme, selectedStory, setSelectedStory, storyId, storyService, t, themeName, userId],
  );

  const themeLabel = t(
    themeDisplayOptions.find((option) => option.value === themeName)?.labelKey ||
      'theme_default_label',
  );
  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = useMemo(
    () =>
      StyleSheet.create({
        title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 6 },
        description: { color: colors.textSecondary, lineHeight: 20, marginBottom: 20 },
        card: {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: 10,
          borderWidth: 1,
          padding: 16,
        },
        cardHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
        cardTitle: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '700' },
        value: { color: colors.textSecondary, lineHeight: 19, marginTop: 7 },
        action: { marginTop: 16 },
        readOnly: { color: colors.textSecondary, lineHeight: 19, marginTop: 16 },
        centered: { alignItems: 'center', flex: 1, justifyContent: 'center' },
      }),
    [colors],
  );

  if (!selectedStory) {
    return (
      <View style={[commonContainerStyles.container, styles.centered]}>
        <Text style={{ color: colors.textSecondary }}>{t('story_not_found')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAwareScreen
      style={commonContainerStyles.container}
      contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
    >
      <Text style={styles.title}>{t('appearance_title')}</Text>
      <Text style={styles.description}>{t('appearance_screen_description')}</Text>
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
        ) : (
          <Text style={styles.readOnly}>{t('story_read_only_error')}</Text>
        )}
      </View>
      <ThemePreview />
      <ThemePickerModal
        visible={pickerVisible}
        value={themeName}
        onPreview={handlePreview}
        onConfirm={handleConfirmTheme}
        onClose={handleClosePicker}
        saving={saving}
      />
    </KeyboardAwareScreen>
  );
};

export default StoryAppearanceScreen;
