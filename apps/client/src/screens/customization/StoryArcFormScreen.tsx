import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import { Button, TextInput } from '@/src/components/common';
import KeyboardAwareScreen from '@/src/components/layout/KeyboardAwareScreen/KeyboardAwareScreen';
import { useDrizzle } from '@/src/db';
import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useFormScrollBottomPadding } from '@/src/hooks/useFormScrollBottomPadding';
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
import type { RouteProp } from '@react-navigation/native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

type Nav = NativeStackNavigationProp<CustomizationStackParamList, 'StoryArcForm'>;

const StoryArcFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDrizzle();
  const navigation = useNavigation<Nav>();
  const { arcId } = useRoute<RouteProp<CustomizationStackParamList, 'StoryArcForm'>>().params;
  const story = useStoryStore((state) => state.selectedStory);
  const { canEdit } = useStoryRole(story?.id);
  const { userId } = useUserSettingsStore();
  const notify = useNotificationStore((state) => state.showNotification);
  const vocab = useStoryVocabulary();
  const scrollBottomPadding = useFormScrollBottomPadding();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!arcId) return;
    void createStoryArcService(db)
      .getById(arcId)
      .then((arc) => {
        if (!arc) return;
        setTitle(arc.title);
        setDescription(arc.description ?? '');
      });
  }, [arcId, db]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: arcId ? vocab.term('Arc') : t('arc_form_title_new', { arc: vocab.term('Arc') }),
        headerRight: undefined,
      });
      setDocumentTitle(vocab.term('Arc'));
    }, [arcId, navigation, t, vocab]),
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
        });
      else
        await service.createArc(userId, {
          storyId: story.id,
          title: title.trim(),
          description: description.trim() || null,
          sortOrder: 0,
          color: null,
          icon: null,
          themeOverride: null,
          isDefault: false,
        });
      navigation.goBack();
    } catch (error) {
      notify(error instanceof Error ? error.message : t('calendar_save_failed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    label: { color: colors.textSecondary, fontSize: 13, marginBottom: 6, marginTop: 12 },
  });

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
      {canEdit ? (
        <FormActions stackOnCompact>
          <Button onPress={() => navigation.goBack()}>{t('cancel')}</Button>
          <Button onPress={handleSave} disabled={saving}>
            {t('save')}
          </Button>
        </FormActions>
      ) : null}
    </KeyboardAwareScreen>
  );
};

export default StoryArcFormScreen;
