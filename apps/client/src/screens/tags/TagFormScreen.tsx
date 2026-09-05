import {
  ScreenError,
  ScreenLoading,
} from '@/src/components/common/feedback/ScreenState/ScreenState';
import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import FormSwitchField from '@/src/components/common/forms/FormSwitchField/FormSwitchField';
import FormField from '@/src/components/common/forms/FormField/FormField';
import EntityFormContainer from '@/src/components/common/forms/EntityFormContainer/EntityFormContainer';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';
import Button from '@/src/components/common/controls/Button/Button';
import ColorPickerInput from '@/src/components/common/inputs/ColorPickerInput/ColorPickerInput';
import TextInput from '@/src/components/common/inputs/TextInput/TextInput';
import type { Tag } from '@keres/shared/entities/Tag';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrizzle } from '../../db';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { TagsStackParamList } from '../../navigation/MainSystemStack'; // Import TagsStackParamList
import { createTagService } from '../../services/storymanagement/TagService';
import { useStoryStore } from '../../state/storyStore';
import { useUserSettingsStore } from '../../state/userSettingsStore'; // Import useUserSettingsStore
import { useTheme } from '../../theme';
import { getCommonInputStyles } from '../../theme/commonStyles';
import { AppAlert } from '../../utils/AppAlert';

type TagFormScreenRouteProp = RouteProp<TagsStackParamList, 'TagForm'>;

const TagFormScreen = () => {
  useBackButtonHandler({ showWebBackButton: true });
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<TagFormScreenRouteProp>();
  const { t } = useTranslation();
  const { userId } = useUserSettingsStore();
  const { tagId } = route.params || {};
  const { selectedStory } = useStoryStore();

  const commonInputStyles = getCommonInputStyles(colors);
  const drizzleDb = useDrizzle();
  const tagService = useCallback(() => createTagService(drizzleDb), [drizzleDb]);
  const confirmDelete = useConfirmDelete();

  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const isEditing = !!tagId;

  useScreenHeader({
    target: 'parent',
    title: isEditing ? t('edit_tag_title') : t('create_tag_title'),
  });

  useEffect(() => {
    const loadTag = async () => {
      setLoadError(null);
      if (!isEditing) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const fetchedTag = await tagService().getById(tagId!);
        if (fetchedTag) {
          setName(fetchedTag.name);
          setColor(fetchedTag.color || '');
          setIsFavorite(fetchedTag.isFavorite);
          setExtraNotes(fetchedTag.extraNotes);
        } else {
          setLoadError(t('tag_data_missing'));
          console.warn('Tag not found:', tagId);
        }
      } catch (err) {
        setLoadError(t('tag_data_missing'));
        console.error('Failed to load tag:', err);
      } finally {
        setLoading(false);
      }
    };
    loadTag();
  }, [tagId, isEditing, tagService, t]);

  const handleSave = () =>
    runSave(async () => {
      if (!name.trim()) {
        AppAlert.alert(t('error'), t('tag_name_required'));
        return;
      }
      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }
      if (!selectedStory?.id) {
        AppAlert.alert(t('error'), t('no_story_selected'));
        return;
      }

      try {
        const tagData: Omit<
          Tag,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          name: name.trim(),
          color: color,
          isFavorite: isFavorite,
          extraNotes: extraNotes,
        };

        if (isEditing) {
          await tagService().updateTag(userId, tagId!, tagData);
          AppAlert.alert(t('success'), t('tag_updated_successfully'));
        } else {
          await tagService().createTag(userId, { ...tagData, storyId: selectedStory.id });
          AppAlert.alert(t('success'), t('tag_created_successfully'));
        }
        navigation.goBack();
      } catch (err) {
        console.error('Failed to save tag:', err);
        AppAlert.alert(t('error'), t('failed_to_save_tag'));
      }
    });

  const handleDelete = () => {
    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }
    if (!tagId) {
      return;
    }

    confirmDelete({
      titleKey: 'delete_tag_title',
      messageKey: 'delete_tag_message',
      successKey: 'tag_deleted_successfully',
      failureKey: 'failed_to_delete_tag',
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await tagService().deleteTag(userId, tagId);
        navigation.goBack();
      },
    });
  };

  if (loading) {
    return <ScreenLoading />;
  }
  if (loadError) {
    return <ScreenError message={loadError} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <EntityFormContainer
      title={isEditing ? t('edit_tag_title') : t('create_tag_title')}
      description={t('tag_form_description')}
      actions={
        <>
          <Button onPress={handleSave} disabled={saving || deleting}>
            {isEditing ? t('save_changes') : t('create_tag')}
          </Button>
          {isEditing && (
            <Button
              onPress={handleDelete}
              style={{ backgroundColor: colors.error }}
              disabled={saving || deleting}
            >
              {t('delete_tag_title')}
            </Button>
          )}
        </>
      }
    >
      <FormField label={t('name')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('name_placeholder')}
            value={name}
            onChangeText={setName}
            style={commonInputStyles.input}
          />
        )}
      </FormField>

      <FormField label={t('color')}>
        <ColorPickerInput
          placeholder={t('select_tag_color')}
          currentColor={color}
          onSelectColor={setColor}
        />
      </FormField>

      <FormSwitchField label={t('is_favorite')} value={isFavorite} onValueChange={setIsFavorite} />

      <FormField label={t('extra_notes')}>
        {(fieldAccessibility) => (
          <TextInput
            {...fieldAccessibility}
            placeholder={t('extra_notes_placeholder')}
            value={extraNotes || ''}
            onChangeText={setExtraNotes}
            style={commonInputStyles.multiline}
            multiline
          />
        )}
      </FormField>
    </EntityFormContainer>
  );
};

export default TagFormScreen;
