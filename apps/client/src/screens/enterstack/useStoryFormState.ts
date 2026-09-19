import { useStoryIdentityDraft } from '@/src/hooks/useStoryIdentityDraft';
import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
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
  // Selected packs whose skeletons stay out: an opt-out list, so a newly picked pack installs its
  // extras unless the author says otherwise - and a deselected pack keeps its answer for reselection.
  const [packsWithoutExtras, setPacksWithoutExtras] = useState<string[]>([]);
  const togglePackExtras = useCallback((packId: string, include: boolean) => {
    setPacksWithoutExtras((current) => {
      if (include) return current.filter((id) => id !== packId);
      return current.includes(packId) ? current : [...current, packId];
    });
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isEditing = !!initialStoryId;

  const applyStoryIdentity = identity.applyStoryIdentity;

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
            applyStoryIdentity(fetchedStory);
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
    // `identity` itself is a new object every render; only the stable apply callback belongs here.
  }, [initialStoryId, storyServiceRef, userId, t, applyStoryIdentity]);

  return {
    initialStoryId,
    identity,
    selectedPackIds,
    setSelectedPackIds,
    packsWithoutExtras,
    togglePackExtras,
    loading,
    error,
    setError,
    isEditing,
  };
}

export type StoryFormState = ReturnType<typeof useStoryFormState>;
