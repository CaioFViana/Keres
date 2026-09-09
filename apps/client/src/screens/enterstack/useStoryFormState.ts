import { useStoryIdentityDraft } from '@/src/hooks/useStoryIdentityDraft';
import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoryService } from '../../services/storymanagement/StoryService';

type UseStoryFormStateOptions = {
  initialStoryId?: string;
  storyServiceRef: RefObject<StoryService | null>;
  userId?: string | null;
};

/** Owns field state and initial story hydration for a Story form. */
export function useStoryFormState({
  initialStoryId,
  storyServiceRef,
  userId,
}: UseStoryFormStateOptions) {
  const { t } = useTranslation();
  const identity = useStoryIdentityDraft();
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!initialStoryId;

  useEffect(() => {
    const loadStory = async () => {
      if (initialStoryId) {
        try {
          setLoading(true);
          if (!storyServiceRef.current) {
            setLoading(false);
            return;
          }
          const fetchedStory = await storyServiceRef.current.getStoryById(
            initialStoryId,
            userId ?? undefined,
          );
          if (fetchedStory) {
            identity.applyStoryIdentity(fetchedStory);
          } else {
            setError(t('story_not_found'));
          }
        } catch (err) {
          console.error('Failed to load story:', err);
          setError(t('failed_to_load_story'));
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    void loadStory();
  }, [initialStoryId, storyServiceRef, userId, t, identity.applyStoryIdentity, identity]);

  return {
    initialStoryId,
    identity,
    selectedPackIds,
    setSelectedPackIds,
    loading,
    error,
    setError,
    isEditing,
  };
}

export type StoryFormState = ReturnType<typeof useStoryFormState>;
