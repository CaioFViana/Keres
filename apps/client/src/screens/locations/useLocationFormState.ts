import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { StorySchemaField } from '@keres/shared';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
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

export type LocationFormDraftFields = {
  name: string;
  description: string | null;
  climate: string | null;
  culture: string | null;
  politics: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
};

const CREATE_PRISTINE: LocationFormDraftFields = {
  name: '',
  description: null,
  climate: null,
  culture: null,
  politics: null,
  isFavorite: false,
  extraNotes: null,
};

function isLocationFormDraftFields(value: unknown): value is LocationFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.name === 'string' &&
    (fields.description === null || typeof fields.description === 'string') &&
    (fields.climate === null || typeof fields.climate === 'string') &&
    (fields.culture === null || typeof fields.culture === 'string') &&
    (fields.politics === null || typeof fields.politics === 'string') &&
    typeof fields.isFavorite === 'boolean' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string')
  );
}

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
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<LocationFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
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
            setLoadedPristine({
              name: fetchedLocation.name,
              description: fetchedLocation.description,
              climate: fetchedLocation.climate,
              culture: fetchedLocation.culture,
              politics: fetchedLocation.politics,
              isFavorite: fetchedLocation.isFavorite,
              extraNotes: fetchedLocation.extraNotes,
            });
            setLoadedUpdatedAt(fetchedLocation.updatedAt?.toISOString?.() ?? null);

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

  const restoreDraftFields = useCallback((fields: LocationFormDraftFields) => {
    if (!isLocationFormDraftFields(fields)) {
      console.error('Corrupt location form draft ignored.');
      return;
    }
    setName(fields.name);
    setDescription(fields.description);
    setClimate(fields.climate);
    setCulture(fields.culture);
    setPolitics(fields.politics);
    setIsFavorite(fields.isFavorite);
    setExtraNotes(fields.extraNotes);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<LocationFormDraftFields>({
      storyId,
      entityType: 'Location',
      entityId: initialLocationId,
      enabled: !!storyId && !loading,
      snapshot: { name, description, climate, culture, politics, isFavorite, extraNotes },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialLocationId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty =
    JSON.stringify({ name, description, climate, culture, politics, isFavorite, extraNotes }) !==
    JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setName(target.name);
    setDescription(target.description);
    setClimate(target.climate);
    setCulture(target.culture);
    setPolitics(target.politics);
    setIsFavorite(target.isFavorite);
    setExtraNotes(target.extraNotes);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

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
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type LocationFormState = ReturnType<typeof useLocationFormState>;
