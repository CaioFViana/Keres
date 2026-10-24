import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '@/src/db';
import { useDurableFormDraft } from '@/src/hooks/forms/useDurableFormDraft';
import { fieldsDiffer, pickFields, useFormFields } from '@/src/hooks/forms/useFormFields';
import { createAttributeValueService } from '@/src/services/storymanagement/entities/AttributeValueService';
import { readEntityFormSecondaryDraft } from '@/src/state/drafts/entityFormSecondaryDraftStore';
import type { ItemService } from '@/src/services/storymanagement/entities/ItemService';
import { logger } from '@/src/utils/logging/logger';

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

const FIELD_KEYS = Object.keys(CREATE_PRISTINE) as (keyof ItemFormDraftFields)[];

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
  const { fields, setters, setAll } = useFormFields(CREATE_PRISTINE);
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
            const row = pickFields(fetchedItem, FIELD_KEYS);
            setAll(row);
            setLoadedPristine(row);
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
            logger.warn('Item not found:', initialItemId);
          }
        }
      } catch (err) {
        logger.error('Failed to load item:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialItemId, itemServiceRef, setAll, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const restoreDraftFields = useCallback(
    (restored: ItemFormDraftFields) => {
      if (!isItemFormDraftFields(restored)) {
        logger.error('Corrupt item form draft ignored.');
        return;
      }
      setAll({ ...CREATE_PRISTINE, ...restored });
    },
    [setAll],
  );

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<ItemFormDraftFields>({
      storyId,
      entityType: 'Item',
      entityId: initialItemId,
      enabled: !!storyId && !loading,
      snapshot: fields,
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialItemId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty = fieldsDiffer(fields, pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setAll(target);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft, setAll]);

  return {
    currentItemId,
    retainPersistedItemId,
    ...fields,
    ...setters,
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
