import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import { Button, TextInput, ThemePickerModal } from '@/src/components/common';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
import { useStoryArcs } from '@/src/hooks/useStoryArcs';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { createStoryArcService } from '@/src/services/storymanagement/StoryArcService';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useStoryStore } from '@/src/state/storyStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';
import { getCommonContainerStyles } from '@/src/theme/commonStyles';
import { setDocumentTitle } from '@/src/utils/documentTitle';
import { resolveEffectiveTheme } from '@/src/utils/storyArcFilter';
import { themeDisplayOptions } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

type Nav = NativeStackNavigationProp<CustomizationStackParamList, 'StoryArcForm'>;

const StoryArcFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors, setTheme: applyTheme } = useTheme();
  const db = useDrizzle();
  const navigation = useNavigation<Nav>();
  const { arcId } = useRoute<RouteProp<CustomizationStackParamList, 'StoryArcForm'>>().params;
  const story = useStoryStore((state) => state.selectedStory);
  const { activeArc } = useStoryArcs();
  const { canEdit } = useStoryRole(story?.id);
  const { userId } = useUserSettingsStore();
  const notify = useNotificationStore((state) => state.showNotification);
  const vocab = useStoryVocabulary();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [themeOverride, setThemeOverride] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const savedEffectiveTheme = resolveEffectiveTheme(story?.theme, activeArc?.themeOverride);
  const restoreSavedTheme = useCallback(
    () => applyTheme(savedEffectiveTheme),
    [applyTheme, savedEffectiveTheme],
  );

  useEffect(() => {
    if (!arcId) return;
    void createStoryArcService(db)
      .getById(arcId)
      .then((arc) => {
        if (!arc) return;
        setTitle(arc.title);
        setDescription(arc.description ?? '');
        setThemeOverride(arc.themeOverride);
      });
  }, [arcId, db]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: arcId ? vocab.term('Arc') : t('arc_form_title_new', { arc: vocab.term('Arc') }),
        headerRight: undefined,
      });
      setDocumentTitle(vocab.term('Arc'));
      return restoreSavedTheme;
    }, [arcId, navigation, restoreSavedTheme, t, vocab]),
  );

  const handleSave = async () => {
    if (!story?.id || !userId || !title.trim()) return;
    setSaving(true);
    try {
      const service = createStoryArcService(db);
      if (arcId)
        await service.updateArc(userId, arcId, {
          title: title.trim(),
          description: description.trim() || null,
          themeOverride,
        });
      else
        await service.createArc(userId, {
          storyId: story.id,
          title: title.trim(),
          description: description.trim() || null,
          sortOrder: 0,
          color: null,
          icon: null,
          themeOverride,
          isDefault: false,
        });
      navigation.goBack();
    } catch (error) {
      notify(error instanceof Error ? error.message : t('calendar_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const themeNameLabel = (themeName: string | null | undefined) =>
    t(
      themeDisplayOptions.find((option) => option.value === (themeName || 'default'))?.labelKey ||
        'theme_default_label',
    );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 12 },
        hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 8 },
        card: {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: 10,
          borderWidth: 1,
          marginTop: 16,
          padding: 16,
        },
        cardHeading: { alignItems: 'center', flexDirection: 'row', gap: 10 },
        cardTitle: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '700' },
        value: { color: colors.textSecondary, lineHeight: 19, marginTop: 7 },
        action: { marginTop: 12 },
        readOnly: { color: colors.textSecondary, lineHeight: 19, marginTop: 16 },
      }),
    [colors],
  );

  return (
    <KeyboardAwareScreen
      contentContainerStyle={[
        getCommonContainerStyles(colors).container,
        { paddingBottom: scrollBottomPadding },
      ]}
    >
      <Text style={styles.label}>{t('name')}</Text>
      <TextInput value={title} onChangeText={setTitle} editable={canEdit} />
      <Text style={styles.label}>{t('description')}</Text>
      <TextInput value={description} onChangeText={setDescription} editable={canEdit} multiline />
      <View style={styles.card}>
        <View style={styles.cardHeading}>
          <Ionicons name="color-palette-outline" size={24} color={colors.primary} />
          <Text style={styles.cardTitle}>{t('theme')}</Text>
        </View>
        <Text style={styles.hint}>{t('arc_theme_description', { arc: vocab.term('Arc') })}</Text>
        <Text style={styles.value}>
          {themeOverride
            ? themeNameLabel(themeOverride)
            : t('arc_theme_inherited', { theme: themeNameLabel(story?.theme) })}
        </Text>
        {canEdit ? (
          <>
            <Button onPress={() => setPickerVisible(true)} style={styles.action}>
              {t('select_theme')}
            </Button>
            {themeOverride ? (
              <Button
                onPress={() => {
                  setThemeOverride(null);
                  restoreSavedTheme();
                }}
                style={styles.action}
              >
                {t('arc_theme_inherit')}
              </Button>
            ) : null}
          </>
        ) : (
          <Text style={styles.readOnly}>{t('story_read_only_error')}</Text>
        )}
      </View>
      {canEdit ? (
        <FormActions stackOnCompact>
          <Button onPress={() => navigation.goBack()}>{t('cancel')}</Button>
          <Button onPress={handleSave} disabled={saving}>
            {t('save')}
          </Button>
        </FormActions>
      ) : null}
      <ThemePickerModal
        visible={pickerVisible}
        value={themeOverride || story?.theme || 'default'}
        onPreview={applyTheme}
        onConfirm={(nextThemeName) => {
          setThemeOverride(nextThemeName);
          restoreSavedTheme();
          setPickerVisible(false);
        }}
        onClose={() => {
          restoreSavedTheme();
          setPickerVisible(false);
        }}
      />
    </KeyboardAwareScreen>
  );
};

export default StoryArcFormScreen;
