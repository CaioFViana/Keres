import { useAsyncOperation } from '@/src/hooks/useAsyncOperation';
import type { Story } from '@keres/shared/entities/Story';
import type { NavigationProp } from '@react-navigation/native';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PackService } from '../../services/storymanagement/PackService';
import type { StoryService } from '../../services/storymanagement/StoryService';
import { AppAlert } from '../../utils/AppAlert';
import type { StoryFormState } from './useStoryFormState';

type StoryFormNavigation = NavigationProp<{
  StoryForm: { storyId?: string };
  StorySelection: undefined;
}>;

type UseStoryFormActionsOptions = {
  state: StoryFormState;
  storyServiceRef: RefObject<StoryService | null>;
  packServiceRef: RefObject<PackService | null>;
  navigation: StoryFormNavigation;
  userId?: string | null;
  canEdit: boolean;
  canManageStoryPolicy: boolean;
};

/** Owns validation, persistence, feedback and navigation for the Story form. */
export function useStoryFormActions({
  state,
  storyServiceRef,
  packServiceRef,
  navigation,
  userId,
  canEdit,
  canManageStoryPolicy,
}: UseStoryFormActionsOptions) {
  const { t } = useTranslation();
  const { pending: saving, run: runSave } = useAsyncOperation();
  const [deleting, setDeleting] = useState(false);
  const { identity } = state;

  const handleSave = () =>
    runSave(async () => {
      if (!canEdit) return;

      if (!identity.title.trim()) {
        AppAlert.alert(t('error'), t('title_required'));
        return;
      }

      if (!userId) {
        AppAlert.alert(t('error'), t('user_not_identified'));
        return;
      }

      if (!storyServiceRef.current) {
        AppAlert.alert(t('error'), t('failed_to_save_story'));
        return;
      }

      state.setError(null);

      try {
        if (state.initialStoryId) {
          // Update never sends `type` (conversion lives on Story Settings), nor
          // `allowReaderComments` / `normalizeSceneTiming` / log cursors (this form doesn't
          // edit them). Sending hardcoded defaults used to reset those fields, and a writer
          // sending `allowReaderComments: false` would now be rejected as owner-only policy.
          await storyServiceRef.current.updateStory(userId, state.initialStoryId, {
            title: identity.title.trim(),
            description: identity.description,
            genre: identity.genre,
            language: identity.language,
            author: identity.author,
            isFavorite: identity.isFavorite,
            extraNotes: identity.extraNotes,
            ...(canManageStoryPolicy ? { favoriteBehavior: identity.favoriteBehavior } : {}),
          });
          AppAlert.alert(t('success'), t('story_updated_successfully'));
        } else {
          const storyData: Omit<
            Story,
            'id' | 'createdAt' | 'updatedAt' | 'version' | 'isDeleted' | 'deletedAt' | 'serverId'
          > = {
            userId: userId!,
            title: identity.title.trim(),
            type: identity.type,
            description: identity.description,
            genre: identity.genre,
            language: identity.language,
            author: identity.author,
            isFavorite: identity.isFavorite,
            favoriteBehavior: identity.favoriteBehavior,
            extraNotes: identity.extraNotes,
            // Appearance is configured after creation under Customization. `null` selects the
            // application default and keeps old exports and newly-created stories consistent.
            theme: null,
            timelineEpochDay: null,
            timelineEpochSeconds: null,
            normalizeSceneTiming: false,
            allowReaderComments: false,
            // On for a new story, unlike the switches around it: linking mentions makes no judgement
            // about the writer's work, it only saves a tap while reading. It is also invisible until
            // the story has both entities and prose, so it cannot surprise anyone early. Existing
            // stories stay off - see migration 0016.
            autoLinkMentions: true,
            // Off, like every existing story: whether an element must be referenced somewhere is the
            // writer's judgement. Story Analysis keeps reporting broken references either way.
            completenessChecks: false,
            // The stats system is turned on later, in Story Settings: a new story
            // never comes into the world with it.
            statSystem: false,
            statNotation: 'letter',
            vocabulary: null,
            lastOperationLog: 0,
            lastServerSyncedLog: 0,
          };
          if (state.selectedPackIds.length > 0) {
            if (!packServiceRef.current) {
              AppAlert.alert(t('error'), t('failed_to_save_story'));
              return;
            }
            const conflicts = await packServiceRef.current.findConflicts(state.selectedPackIds);
            if (conflicts.length > 0) {
              // Named here rather than left to the import's integrity check, whose message describes a
              // corrupt file and not two packs somebody chose.
              AppAlert.alert(
                t('packs_conflict_title'),
                conflicts
                  .map((conflict) =>
                    t(`packs_conflict_${conflict.kind}`, { detail: conflict.detail }),
                  )
                  .join('\n'),
              );

              return;
            }
            await packServiceRef.current.createStoryWithPacks(
              userId,
              storyData,
              state.selectedPackIds,
            );
          } else {
            await storyServiceRef.current.createStory(userId, storyData);
          }
          AppAlert.alert(t('success'), t('story_created_successfully'));
        }
        navigation.goBack();
      } catch (err) {
        console.error('Failed to save story:', err);
        state.setError(t('failed_to_save_story'));
        AppAlert.alert(t('error'), t('failed_to_save_story'));
      }
    });

  const handleDelete = () => {
    if (!canManageStoryPolicy) return;

    if (!userId) {
      AppAlert.alert(t('error'), t('user_not_identified'));
      return;
    }

    AppAlert.alert(
      t('delete_story_title'),
      t('delete_story_message'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('delete'),
          onPress: async () => {
            if (state.initialStoryId && storyServiceRef.current) {
              try {
                setDeleting(true);
                await storyServiceRef.current.deleteStory(state.initialStoryId);
                AppAlert.alert(t('success'), t('story_deleted_successfully'));
                navigation.goBack();
              } catch (err) {
                console.error('Failed to delete story:', err);
                state.setError(t('failed_to_delete_story'));
                AppAlert.alert(t('error'), t('failed_to_delete_story'));
              } finally {
                setDeleting(false);
              }
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: true },
    );
  };

  return { deleting, handleDelete, handleSave, saving };
}
