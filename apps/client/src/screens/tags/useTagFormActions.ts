import type { Tag } from '@keres/shared/entities/Tag';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useEntityFormActions } from '../../hooks/useEntityFormActions';
import type { TagsStackParamList } from '../../navigation/MainSystemStack';
import type { TagService } from '../../services/storymanagement/TagService';
import type { TagFormState } from './useTagFormState';

type TagNavigation = NativeStackNavigationProp<TagsStackParamList, 'TagForm'>;
type TagData = Omit<
  Tag,
  'id' | 'storyId' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt'
>;

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

  return useEntityFormActions<TagData, { id: string }>({
    storyId,
    userId,
    currentEntityId: state.tagId,
    isServiceReady: () => !!tagServiceRef.current,
    clearFormDraft: state.clearFormDraft,
    retainPersistedId: () => {},
    validate: () => (state.name.trim() ? null : t('tag_name_required')),
    buildData: () => ({
      name: state.name.trim(),
      color: state.color,
      isFavorite: state.isFavorite,
      extraNotes: state.extraNotes,
    }),
    create: (user, story, data) =>
      tagServiceRef.current!.createTag(user, { ...data, storyId: story }),
    update: (user, tagId, data) => tagServiceRef.current!.updateTag(user, tagId, data),
    remove: (user, tagId) => tagServiceRef.current!.deleteTag(user, tagId),
    messages: {
      failedToSave: t('failed_to_save_tag'),
      created: t('tag_created_successfully'),
      updated: t('tag_updated_successfully'),
    },
    confirmDelete: {
      titleKey: 'delete_tag_title',
      messageKey: 'delete_tag_message',
      successKey: 'tag_deleted_successfully',
      failureKey: 'failed_to_delete_tag',
    },
    afterSave: () => navigation.goBack(),
    afterDelete: () => navigation.goBack(),
    logName: 'tag',
  });
}
