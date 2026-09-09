import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ItemJourneyService } from '../../services/storymanagement/ItemJourneyService';

type UseItemJourneyFormStateOptions = {
  initialItemJourneyId?: string;
  prefilledItemId?: string;
  storyId?: string;
  itemJourneyServiceRef: RefObject<ItemJourneyService | null>;
};

/** Owns field state and initial item-journey hydration for an ItemJourney form. */
export function useItemJourneyFormState({
  initialItemJourneyId,
  prefilledItemId,
  storyId,
  itemJourneyServiceRef,
}: UseItemJourneyFormStateOptions) {
  const [currentItemJourneyId, setCurrentItemJourneyId] = useState<string | undefined>(
    initialItemJourneyId,
  );
  const [itemId, setItemId] = useState<string | null>(prefilledItemId ?? null);
  const [sceneId, setSceneId] = useState<string | null>(null);
  const [newCharacterOwnerId, setNewCharacterOwnerId] = useState<string | null>(null);
  const [newState, setNewState] = useState('');
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const isEditing = !!currentItemJourneyId;
  const retainPersistedItemJourneyId = useCallback((itemJourneyId: string) => {
    setCurrentItemJourneyId(itemJourneyId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!itemJourneyServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialItemJourneyId) {
          const fetchedItemJourney =
            await itemJourneyServiceRef.current.getById(initialItemJourneyId);
          if (fetchedItemJourney) {
            setItemId(fetchedItemJourney.itemId);
            setSceneId(fetchedItemJourney.sceneId);
            setNewCharacterOwnerId(fetchedItemJourney.newCharacterOwnerId);
            setNewState(fetchedItemJourney.newState);
            setExtraNotes(fetchedItemJourney.extraNotes);
          } else {
            console.warn('Item journey not found:', initialItemJourneyId);
          }
        }
      } catch (err) {
        console.error('Failed to load item journey:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [initialItemJourneyId, itemJourneyServiceRef, storyId]);

  return {
    currentItemJourneyId,
    retainPersistedItemJourneyId,
    itemId,
    setItemId,
    sceneId,
    setSceneId,
    newCharacterOwnerId,
    setNewCharacterOwnerId,
    newState,
    setNewState,
    extraNotes,
    setExtraNotes,
    loading,
    isEditing,
  };
}

export type ItemJourneyFormState = ReturnType<typeof useItemJourneyFormState>;
