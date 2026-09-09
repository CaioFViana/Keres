import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { Tag } from '@keres/shared/entities/Tag';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConfirmDelete } from '../../hooks/useConfirmDelete';
import type { TagsStackParamList } from '../../navigation/MainSystemStack';
import type { TagService } from '../../services/storymanagement/TagService';
import { AppAlert } from '../../utils/AppAlert';
import type { TagFormState } from './useTagFormState';

type TagNavigation = NativeStackNavigationProp<TagsStackParamList, 'TagForm'>;

type UseTagFormActionsOptions = {
  state: TagFormState;
  tagServiceRef: RefObject<TagService | null>;
  navigation: TagNavigation;
  storyId?: string;
  userId?: string | null;
};

/** Owns validation, persistence, feedback and navigation for the Tag form. */
export function useTagFormActions({
  state,
  tagServiceRef,
  navigation,
  storyId,
  userId,
}: UseTagFormActionsOptions) {
  const { t } = useTranslation();
  const confirmDelete = useConfirmDelete();
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);

  const handleSave = () =>
    runSave(async () => {
      if (!state.name.trim()) {
        AppAlert.alert(t('error'), t('tag_name_required'));
        return;
      }
      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }
      if (!storyId) {
        AppAlert.alert(t('error'), t('no_story_selected'));
        return;
      }
      if (!tagServiceRef.current) {
        AppAlert.alert(t('error'), t('failed_to_save_tag'));
        return;
      }

      try {
        const tagData: Omit<
          Tag,
          'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
        > = {
          name: state.name.trim(),
          color: state.color,
          isFavorite: state.isFavorite,
          extraNotes: state.extraNotes,
        };

        if (state.isEditing) {
          await tagServiceRef.current.updateTag(userId, state.tagId!, tagData);
          AppAlert.alert(t('success'), t('tag_updated_successfully'));
        } else {
          await tagServiceRef.current.createTag(userId, { ...tagData, storyId });
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
    if (!state.tagId || !tagServiceRef.current) {
      return;
    }

    const tagId = state.tagId;
    confirmDelete({
      titleKey: 'delete_tag_title',
      messageKey: 'delete_tag_message',
      successKey: 'tag_deleted_successfully',
      failureKey: 'failed_to_delete_tag',
      onLoadingChange: setDeleting,
      onConfirm: async () => {
        await tagServiceRef.current!.deleteTag(userId, tagId);
        navigation.goBack();
      },
    });
  };

  return { deleting, handleDelete, handleSave, saving };
}
