import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { readEntityFormSecondaryDraft } from '../../services/storymanagement/EntityFormSecondaryDraftStore';
import type { ItemService } from '../../services/storymanagement/ItemService';

type UseItemFormStateOptions = {
  initialItemId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  itemServiceRef: RefObject<ItemService | null>;
  customFields: StorySchemaField[];
};

export type ItemFormDraftFields = {
  name: string;
  category: string | null;
  description: string | null;
  initialState: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
  characterOwnerId: string | null;
};

const CREATE_PRISTINE: ItemFormDraftFields = {
  name: '',
  category: null,
  description: null,
  initialState: null,
  isFavorite: false,
  extraNotes: null,
  characterOwnerId: null,
};

function isItemFormDraftFields(value: unknown): value is ItemFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.name === 'string' &&
    (fields.category === null || typeof fields.category === 'string') &&
    (fields.description === null || typeof fields.description === 'string') &&
    (fields.initialState === null || typeof fields.initialState === 'string') &&
    typeof fields.isFavorite === 'boolean' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string') &&
    (fields.characterOwnerId === null || typeof fields.characterOwnerId === 'string')
  );
}

/** Owns field state, initial item hydration and defaults for an Item form. */
export function useItemFormState({
  initialItemId,
  storyId,
  drizzleDb,
  itemServiceRef,
  customFields,
}: UseItemFormStateOptions) {
  const [currentItemId, setCurrentItemId] = useState<string | undefined>(initialItemId);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [initialState, setInitialState] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [characterOwnerId, setCharacterOwnerId] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<ItemFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentItemId;
  const retainPersistedItemId = useCallback((itemId: string) => {
    setCurrentItemId(itemId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!itemServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialItemId) {
          const fetchedItem = await itemServiceRef.current.getById(initialItemId);
          if (fetchedItem) {
            setName(fetchedItem.name);
            setCategory(fetchedItem.category);
            setDescription(fetchedItem.description);
            setInitialState(fetchedItem.initialState);
            setIsFavorite(fetchedItem.isFavorite);
            setExtraNotes(fetchedItem.extraNotes);
            setCharacterOwnerId(fetchedItem.characterOwnerId);
            setLoadedPristine({
              name: fetchedItem.name,
              category: fetchedItem.category,
              description: fetchedItem.description,
              initialState: fetchedItem.initialState,
              isFavorite: fetchedItem.isFavorite,
              extraNotes: fetchedItem.extraNotes,
              characterOwnerId: fetchedItem.characterOwnerId,
            });
            setLoadedUpdatedAt(fetchedItem.updatedAt?.toISOString?.() ?? null);

            const existingValues =
              await createAttributeValueService(drizzleDb).getValuesForEntity(initialItemId);
            const fromDb = Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value]));
            const draft = await readEntityFormSecondaryDraft(storyId, 'Item', initialItemId);
            setCustomValues(
              draft && Object.keys(draft.customValues).length > 0
                ? { ...fromDb, ...draft.customValues }
                : fromDb,
            );
          } else {
            console.warn('Item not found:', initialItemId);
          }
        }
      } catch (err) {
        console.error('Failed to load item:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialItemId, itemServiceRef, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const restoreDraftFields = useCallback((fields: ItemFormDraftFields) => {
    if (!isItemFormDraftFields(fields)) {
      console.error('Corrupt item form draft ignored.');
      return;
    }
    setName(fields.name);
    setCategory(fields.category);
    setDescription(fields.description);
    setInitialState(fields.initialState);
    setIsFavorite(fields.isFavorite);
    setExtraNotes(fields.extraNotes);
    setCharacterOwnerId(fields.characterOwnerId);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<ItemFormDraftFields>({
      storyId,
      entityType: 'Item',
      entityId: initialItemId,
      enabled: !!storyId && !loading,
      snapshot: {
        name,
        category,
        description,
        initialState,
        isFavorite,
        extraNotes,
        characterOwnerId,
      },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialItemId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty =
    JSON.stringify({
      name,
      category,
      description,
      initialState,
      isFavorite,
      extraNotes,
      characterOwnerId,
    }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setName(target.name);
    setCategory(target.category);
    setDescription(target.description);
    setInitialState(target.initialState);
    setIsFavorite(target.isFavorite);
    setExtraNotes(target.extraNotes);
    setCharacterOwnerId(target.characterOwnerId);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

  return {
    currentItemId,
    retainPersistedItemId,
    name,
    setName,
    category,
    setCategory,
    description,
    setDescription,
    initialState,
    setInitialState,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    characterOwnerId,
    setCharacterOwnerId,
    customValues,
    setCustomValues,
    loading,
    isEditing,
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type ItemFormState = ReturnType<typeof useItemFormState>;
