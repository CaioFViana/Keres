import type { RefObject } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
import type { ItemJourneyService } from '../../services/storymanagement/ItemJourneyService';

type UseItemJourneyFormStateOptions = {
  initialItemJourneyId?: string;
  prefilledItemId?: string;
  storyId?: string;
  itemJourneyServiceRef: RefObject<ItemJourneyService | null>;
};

export type ItemJourneyFormDraftFields = {
  itemId: string | null;
  sceneId: string | null;
  newCharacterOwnerId: string | null;
  newState: string;
  extraNotes: string | null;
};

const CREATE_PRISTINE: ItemJourneyFormDraftFields = {
  itemId: null,
  sceneId: null,
  newCharacterOwnerId: null,
  newState: '',
  extraNotes: null,
};

function isItemJourneyFormDraftFields(value: unknown): value is ItemJourneyFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    (fields.itemId === null || typeof fields.itemId === 'string') &&
    (fields.sceneId === null || typeof fields.sceneId === 'string') &&
    (fields.newCharacterOwnerId === null || typeof fields.newCharacterOwnerId === 'string') &&
    typeof fields.newState === 'string' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string')
  );
}

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
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<ItemJourneyFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
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
            setLoadedPristine({
              itemId: fetchedItemJourney.itemId,
              sceneId: fetchedItemJourney.sceneId,
              newCharacterOwnerId: fetchedItemJourney.newCharacterOwnerId,
              newState: fetchedItemJourney.newState,
              extraNotes: fetchedItemJourney.extraNotes,
            });
            setLoadedUpdatedAt(fetchedItemJourney.updatedAt?.toISOString?.() ?? null);
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

  // An item prefill is the starting point, not a change: reset keeps it and no draft is
  // written until the user actually types.
  const createPristine = useMemo(
    () => ({ ...CREATE_PRISTINE, itemId: prefilledItemId ?? null }),
    [prefilledItemId],
  );

  const restoreDraftFields = useCallback((fields: ItemJourneyFormDraftFields) => {
    if (!isItemJourneyFormDraftFields(fields)) {
      console.error('Corrupt item journey form draft ignored.');
      return;
    }
    setItemId(fields.itemId);
    setSceneId(fields.sceneId);
    setNewCharacterOwnerId(fields.newCharacterOwnerId);
    setNewState(fields.newState);
    setExtraNotes(fields.extraNotes);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<ItemJourneyFormDraftFields>({
      storyId,
      entityType: 'ItemJourney',
      entityId: initialItemJourneyId,
      enabled: !!storyId && !loading,
      snapshot: { itemId, sceneId, newCharacterOwnerId, newState, extraNotes },
      pristine: loadedPristine ?? createPristine,
      baseUpdatedAt: initialItemJourneyId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? createPristine;
  const isDirty =
    JSON.stringify({ itemId, sceneId, newCharacterOwnerId, newState, extraNotes }) !==
    JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues keep their own lifecycle and are
   * untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? createPristine;
    setItemId(target.itemId);
    setSceneId(target.sceneId);
    setNewCharacterOwnerId(target.newCharacterOwnerId);
    setNewState(target.newState);
    setExtraNotes(target.extraNotes);
    await deleteStoredDraft();
  }, [loadedPristine, createPristine, deleteStoredDraft]);

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
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type ItemJourneyFormState = ReturnType<typeof useItemJourneyFormState>;
