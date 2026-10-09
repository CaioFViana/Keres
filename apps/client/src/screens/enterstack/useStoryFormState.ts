import { useStoryIdentityDraft } from '@/src/hooks/useStoryIdentityDraft';
import { DEFAULT_ARC_MEDIUM, type ArcMedium } from '@keres/shared/metadata/ArcMedium';
import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StoryStart } from '../../components/features/story/StoryStartChoice';
import type { StoryService } from '../../services/storymanagement/StoryService';

type UseStoryFormStateOptions = {
  initialStoryId?: string;
  storyServiceRef: RefObject<StoryService | null>;
  userId?: string | null;
  /** How the form opens: the list's cards send a person straight to the option they chose. */
  initialStart?: StoryStart;
};

/** Owns field state and initial story hydration for a Story form. */
export function useStoryFormState({
  initialStoryId,
  storyServiceRef,
  userId,
  initialStart,
}: UseStoryFormStateOptions) {
  const { t } = useTranslation();
  const identity = useStoryIdentityDraft();
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [start, setStartState] = useState<StoryStart>(initialStart ?? 'blank');
  // Going back to a blank story lets go of the packs picked: what is hidden must not be applied.
  const setStart = useCallback((next: StoryStart) => {
    setStartState(next);
    if (next === 'blank') setSelectedPackIds([]);
  }, []);
  // Selected packs whose skeletons stay out: an opt-out list, so a newly picked pack installs its
  // extras unless the author says otherwise - and a deselected pack keeps its answer for reselection.
  const [packsWithoutExtras, setPacksWithoutExtras] = useState<string[]>([]);
  const togglePackExtras = useCallback((packId: string, include: boolean) => {
    setPacksWithoutExtras((current) => {
      if (include) return current.filter((id) => id !== packId);
      return current.includes(packId) ? current : [...current, packId];
    });
  }, []);
  // The form of the first work; only used while creating, when the story's first Arc is made.
  const [arcMedium, setArcMedium] = useState<ArcMedium>(DEFAULT_ARC_MEDIUM);
  // Whether the story is for adults only, chosen as it is made; afterwards it is Story Settings' to change.
  const [isNsfw, setIsNsfw] = useState(false);
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
    start,
    setStart,
    selectedPackIds,
    setSelectedPackIds,
    packsWithoutExtras,
    togglePackExtras,
    arcMedium,
    setArcMedium,
    isNsfw,
    setIsNsfw,
    loading,
    error,
    setError,
    isEditing,
  };
}

export type StoryFormState = ReturnType<typeof useStoryFormState>;
