import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import { useDurableFormDraft } from '@/src/hooks/useDurableFormDraft';
import { useFormResetHeaderAction } from '@/src/hooks/useFormResetHeaderAction';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import { Button, TextInput, ThemePickerModal } from '@/src/components/common';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useStoryArcs } from '@/src/hooks/useStoryArcs';
import { useStoryRole } from '@/src/hooks/useStoryRole';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';
import type { CustomizationStackParamList } from '@/src/navigation/MainSystemStack';
import { createStoryArcService } from '@/src/services/storymanagement/StoryArcService';
import { useNotificationStore } from '@/src/state/notificationStore';
import { useStoryStore } from '@/src/state/storyStore';
import { useUserSettingsStore } from '@/src/state/userSettingsStore';
import { useTheme } from '@/src/theme';
import { getCommonInputStyles } from '@/src/theme/commonStyles';
import { resolveEffectiveTheme } from '@/src/utils/storyArcFilter';
import { themeDisplayOptions } from '@keres/shared';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

type Nav = NativeStackNavigationProp<CustomizationStackParamList, 'StoryArcForm'>;

type ArcFormDraftFields = { title: string; description: string; themeOverride: string | null };

const CREATE_PRISTINE: ArcFormDraftFields = { title: '', description: '', themeOverride: null };

const isArcFormDraftFields = (fields: ArcFormDraftFields): boolean =>
  typeof fields.title === 'string' &&
  typeof fields.description === 'string' &&
  (fields.themeOverride === null || typeof fields.themeOverride === 'string');

const StoryArcFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors, setTheme: applyTheme } = useTheme();
  const commonInputStyles = getCommonInputStyles(colors);
  const db = useDrizzle();
  const navigation = useNavigation<Nav>();
  const { arcId } = useRoute<RouteProp<CustomizationStackParamList, 'StoryArcForm'>>().params;
  const story = useStoryStore((state) => state.selectedStory);
  const { activeArc } = useStoryArcs();
  const { canEdit } = useStoryRole(story?.id);
  const { userId } = useUserSettingsStore();
  const notify = useNotificationStore((state) => state.showNotification);
  const vocab = useStoryVocabulary();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [themeOverride, setThemeOverride] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const isEditing = !!arcId;
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate). Creation pristine is known upfront.
  const [loaded, setLoaded] = useState(!arcId);
  const [loadedPristine, setLoadedPristine] = useState<ArcFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);

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
        setLoadedPristine({
          title: arc.title,
          description: arc.description ?? '',
          themeOverride: arc.themeOverride,
        });
        setLoadedUpdatedAt(arc.updatedAt?.toISOString?.() ?? null);
        setLoaded(true);
      });
  }, [arcId, db]);

  const restoreDraftFields = useCallback((fields: ArcFormDraftFields) => {
    if (!isArcFormDraftFields(fields)) {
      console.error('Corrupt arc form draft ignored.');
      return;
    }
    setTitle(fields.title);
    setDescription(fields.description);
    setThemeOverride(fields.themeOverride);
  }, []);

  const { clearFormDraft, deleteStoredDraft } = useDurableFormDraft<ArcFormDraftFields>({
    storyId: story?.id,
    entityType: 'StoryArc',
    entityId: arcId,
    enabled: !!story?.id && loaded,
    snapshot: { title, description, themeOverride },
    pristine: loadedPristine ?? CREATE_PRISTINE,
    baseUpdatedAt: arcId ? loadedUpdatedAt : undefined,
    onRestore: restoreDraftFields,
  });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty =
    JSON.stringify({ title, description, themeOverride }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setTitle(target.title);
    setDescription(target.description);
    setThemeOverride(target.themeOverride);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

  const resetHeaderAction = useFormResetHeaderAction({ isEditing, isDirty, resetForm });

  useScreenHeader({
    target: 'parent',
    title: arcId ? vocab.term('Arc') : t('arc_form_title_new', { arc: vocab.term('Arc') }),
    documentTitle: vocab.term('Arc'),
    actions: resetHeaderAction,
  });
  useFocusEffect(
    useCallback(() => {
      return restoreSavedTheme;
    }, [restoreSavedTheme]),
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
      await clearFormDraft();
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
    <EntityFormContainer>
      <FormField label={t('name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            value={title}
            onChangeText={setTitle}
            editable={canEdit}
          />
        )}
      </FormField>
      <FormField label={t('description')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            value={description}
            onChangeText={setDescription}
            editable={canEdit}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>
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
    </EntityFormContainer>
  );
};

export default StoryArcFormScreen;
