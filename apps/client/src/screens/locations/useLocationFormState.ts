import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { readEntityFormSecondaryDraft } from '../../services/storymanagement/EntityFormSecondaryDraftStore';
import type { LocationService } from '../../services/storymanagement/LocationService';

type UseLocationFormStateOptions = {
  initialLocationId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  locationServiceRef: RefObject<LocationService | null>;
  customFields: StorySchemaField[];
};

/** Owns field state, initial location hydration and defaults for a Location form. */
export function useLocationFormState({
  initialLocationId,
  storyId,
  drizzleDb,
  locationServiceRef,
  customFields,
}: UseLocationFormStateOptions) {
  const [currentLocationId, setCurrentLocationId] = useState<string | undefined>(initialLocationId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [climate, setClimate] = useState<string | null>(null);
  const [culture, setCulture] = useState<string | null>(null);
  const [politics, setPolitics] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentLocationId;
  const retainPersistedLocationId = useCallback((locationId: string) => {
    setCurrentLocationId(locationId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!locationServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialLocationId) {
          const fetchedLocation = await locationServiceRef.current.getById(initialLocationId);
          if (fetchedLocation) {
            setName(fetchedLocation.name);
            setDescription(fetchedLocation.description);
            setClimate(fetchedLocation.climate);
            setCulture(fetchedLocation.culture);
            setPolitics(fetchedLocation.politics);
            setIsFavorite(fetchedLocation.isFavorite);
            setExtraNotes(fetchedLocation.extraNotes);

            const existingValues =
              await createAttributeValueService(drizzleDb).getValuesForEntity(initialLocationId);
            const fromDb = Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value]));
            const draft = await readEntityFormSecondaryDraft(
              storyId,
              'Location',
              initialLocationId,
            );
            setCustomValues(
              draft && Object.keys(draft.customValues).length > 0
                ? { ...fromDb, ...draft.customValues }
                : fromDb,
            );
          } else {
            console.warn('Location not found:', initialLocationId);
          }
        }
      } catch (err) {
        console.error('Failed to load location:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialLocationId, locationServiceRef, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  return {
    currentLocationId,
    retainPersistedLocationId,
    name,
    setName,
    description,
    setDescription,
    climate,
    setClimate,
    culture,
    setCulture,
    politics,
    setPolitics,
    isFavorite,
    setIsFavorite,
    extraNotes,
    setExtraNotes,
    customValues,
    setCustomValues,
    loading,
    isEditing,
  };
}

export type LocationFormState = ReturnType<typeof useLocationFormState>;
