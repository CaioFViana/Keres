import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import type { ItemService } from '../../services/storymanagement/ItemService';

type UseItemFormStateOptions = {
  initialItemId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  itemServiceRef: RefObject<ItemService | null>;
  customFields: StorySchemaField[];
};

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

            const existingValues =
              await createAttributeValueService(drizzleDb).getValuesForEntity(initialItemId);
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
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
  };
}

export type ItemFormState = ReturnType<typeof useItemFormState>;
