import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldsDiffer, pickFields, useFormFields } from '@/src/hooks/forms/useFormFields';
import type { AppDrizzleClient } from '@/src/db';
import { useDurableFormDraft } from '@/src/hooks/forms/useDurableFormDraft';
import { createAttributeValueService } from '@/src/services/storymanagement/entities/AttributeValueService';
import { readEntityFormSecondaryDraft } from '@/src/state/drafts/entityFormSecondaryDraftStore';
import type { CharacterService } from '@/src/services/storymanagement/entities/CharacterService';
import type { StorySchemaField } from '@keres/shared';
import { logger } from '@/src/utils/logging/logger';

type UseCharacterFormStateOptions = {
  initialCharacterId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  characterServiceRef: RefObject<CharacterService | null>;
  customFields: StorySchemaField[];
};

export type CharacterFormDraftFields = {
  name: string;
  title: string | null;
  description: string | null;
  gender: string | null;
  race: string | null;
  subrace: string | null;
  personality: string | null;
  motivation: string | null;
  qualities: string | null;
  weaknesses: string | null;
  biography: string | null;
  plannedTimeline: string | null;
  isFavorite: boolean;
  extraNotes: string | null;
};

const CREATE_PRISTINE: CharacterFormDraftFields = {
  name: '',
  title: null,
  description: null,
  gender: null,
  race: null,
  subrace: null,
  personality: null,
  motivation: null,
  qualities: null,
  weaknesses: null,
  biography: null,
  plannedTimeline: null,
  isFavorite: false,
  extraNotes: null,
};

const FIELD_KEYS = Object.keys(CREATE_PRISTINE) as (keyof CharacterFormDraftFields)[];

function isCharacterFormDraftFields(value: unknown): value is CharacterFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return (
    typeof fields.name === 'string' &&
    (fields.title === null || typeof fields.title === 'string') &&
    (fields.description === null || typeof fields.description === 'string') &&
    (fields.gender === null || typeof fields.gender === 'string') &&
    (fields.race === null || typeof fields.race === 'string') &&
    (fields.subrace === null || typeof fields.subrace === 'string') &&
    (fields.personality === null || typeof fields.personality === 'string') &&
    (fields.motivation === null || typeof fields.motivation === 'string') &&
    (fields.qualities === null || typeof fields.qualities === 'string') &&
    (fields.weaknesses === null || typeof fields.weaknesses === 'string') &&
    (fields.biography === null || typeof fields.biography === 'string') &&
    (fields.plannedTimeline === null || typeof fields.plannedTimeline === 'string') &&
    typeof fields.isFavorite === 'boolean' &&
    (fields.extraNotes === null || typeof fields.extraNotes === 'string')
  );
}

/** Owns field state, initial character hydration and defaults for a Character form. */
export function useCharacterFormState({
  initialCharacterId,
  storyId,
  drizzleDb,
  characterServiceRef,
  customFields,
}: UseCharacterFormStateOptions) {
  const [currentCharacterId, setCurrentCharacterId] = useState<string | undefined>(
    initialCharacterId,
  );
  const { fields, setters, setAll } = useFormFields(CREATE_PRISTINE);
  const [customValues, setCustomValues] = useState<CustomAttributeValues>({});
  const [loading, setLoading] = useState(true);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<CharacterFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const customDefaultsAppliedRef = useRef(false);
  const isEditing = !!currentCharacterId;
  const retainPersistedCharacterId = useCallback((characterId: string) => {
    setCurrentCharacterId(characterId);
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!characterServiceRef.current || !storyId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (initialCharacterId) {
          const fetchedCharacter = await characterServiceRef.current.getById(initialCharacterId);
          if (fetchedCharacter) {
            const row = pickFields(fetchedCharacter, FIELD_KEYS);
            setAll(row);
            setLoadedPristine(row);
            setLoadedUpdatedAt(fetchedCharacter.updatedAt?.toISOString?.() ?? null);

            const existingValues =
              await createAttributeValueService(drizzleDb).getValuesForEntity(initialCharacterId);
            const fromDb = Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value]));
            const draft = await readEntityFormSecondaryDraft(
              storyId,
              'Character',
              initialCharacterId,
            );
            setCustomValues(
              draft && Object.keys(draft.customValues).length > 0
                ? { ...fromDb, ...draft.customValues }
                : fromDb,
            );
          } else {
            logger.warn('Character not found:', initialCharacterId);
          }
        }
      } catch (err) {
        logger.error('Failed to load character:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialCharacterId, characterServiceRef, setAll, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const restoreDraftFields = useCallback(
    (restored: CharacterFormDraftFields) => {
      if (!isCharacterFormDraftFields(restored)) {
        logger.error('Corrupt character form draft ignored.');
        return;
      }
      setAll(restored);
    },
    [setAll],
  );

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<CharacterFormDraftFields>({
      storyId,
      entityType: 'Character',
      entityId: initialCharacterId,
      enabled: !!storyId && !loading,
      snapshot: fields,
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialCharacterId ? loadedUpdatedAt : undefined,
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
    currentCharacterId,
    retainPersistedCharacterId,
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

export type CharacterFormState = ReturnType<typeof useCharacterFormState>;
