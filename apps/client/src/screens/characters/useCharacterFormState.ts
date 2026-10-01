import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import { readEntityFormSecondaryDraft } from '../../services/storymanagement/EntityFormSecondaryDraftStore';
import type { CharacterService } from '../../services/storymanagement/CharacterService';
import type { StorySchemaField } from '@keres/shared';

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
  const [name, setName] = useState('');
  const [title, setTitle] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [race, setRace] = useState<string | null>(null);
  const [subrace, setSubrace] = useState<string | null>(null);
  const [personality, setPersonality] = useState<string | null>(null);
  const [motivation, setMotivation] = useState<string | null>(null);
  const [qualities, setQualities] = useState<string | null>(null);
  const [weaknesses, setWeaknesses] = useState<string | null>(null);
  const [biography, setBiography] = useState<string | null>(null);
  const [plannedTimeline, setPlannedTimeline] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [extraNotes, setExtraNotes] = useState<string | null>(null);
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
            setName(fetchedCharacter.name);
            setTitle(fetchedCharacter.title);
            setDescription(fetchedCharacter.description);
            setGender(fetchedCharacter.gender);
            setRace(fetchedCharacter.race);
            setSubrace(fetchedCharacter.subrace);
            setPersonality(fetchedCharacter.personality);
            setMotivation(fetchedCharacter.motivation);
            setQualities(fetchedCharacter.qualities);
            setWeaknesses(fetchedCharacter.weaknesses);
            setBiography(fetchedCharacter.biography);
            setPlannedTimeline(fetchedCharacter.plannedTimeline);
            setIsFavorite(fetchedCharacter.isFavorite);
            setExtraNotes(fetchedCharacter.extraNotes);
            setLoadedPristine({
              name: fetchedCharacter.name,
              title: fetchedCharacter.title,
              description: fetchedCharacter.description,
              gender: fetchedCharacter.gender,
              race: fetchedCharacter.race,
              subrace: fetchedCharacter.subrace,
              personality: fetchedCharacter.personality,
              motivation: fetchedCharacter.motivation,
              qualities: fetchedCharacter.qualities,
              weaknesses: fetchedCharacter.weaknesses,
              biography: fetchedCharacter.biography,
              plannedTimeline: fetchedCharacter.plannedTimeline,
              isFavorite: fetchedCharacter.isFavorite,
              extraNotes: fetchedCharacter.extraNotes,
            });
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
            console.warn('Character not found:', initialCharacterId);
          }
        }
      } catch (err) {
        console.error('Failed to load character:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [drizzleDb, initialCharacterId, characterServiceRef, storyId]);

  useEffect(() => {
    if (!isEditing && !customDefaultsAppliedRef.current && customFields.length > 0) {
      setCustomValues(getDefaultCustomAttributeValues(customFields));
      customDefaultsAppliedRef.current = true;
    }
  }, [isEditing, customFields]);

  const restoreDraftFields = useCallback((fields: CharacterFormDraftFields) => {
    if (!isCharacterFormDraftFields(fields)) {
      console.error('Corrupt character form draft ignored.');
      return;
    }
    setName(fields.name);
    setTitle(fields.title);
    setDescription(fields.description);
    setGender(fields.gender);
    setRace(fields.race);
    setSubrace(fields.subrace);
    setPersonality(fields.personality);
    setMotivation(fields.motivation);
    setQualities(fields.qualities);
    setWeaknesses(fields.weaknesses);
    setBiography(fields.biography);
    setPlannedTimeline(fields.plannedTimeline);
    setIsFavorite(fields.isFavorite);
    setExtraNotes(fields.extraNotes);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<CharacterFormDraftFields>({
      storyId,
      entityType: 'Character',
      entityId: initialCharacterId,
      enabled: !!storyId && !loading,
      snapshot: {
        name,
        title,
        description,
        gender,
        race,
        subrace,
        personality,
        motivation,
        qualities,
        weaknesses,
        biography,
        plannedTimeline,
        isFavorite,
        extraNotes,
      },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: initialCharacterId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty =
    JSON.stringify({
      name,
      title,
      description,
      gender,
      race,
      subrace,
      personality,
      motivation,
      qualities,
      weaknesses,
      biography,
      plannedTimeline,
      isFavorite,
      extraNotes,
    }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again. Secondary queues (tags, notes, relations, customs)
   * keep their own lifecycle and are untouched.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setName(target.name);
    setTitle(target.title);
    setDescription(target.description);
    setGender(target.gender);
    setRace(target.race);
    setSubrace(target.subrace);
    setPersonality(target.personality);
    setMotivation(target.motivation);
    setQualities(target.qualities);
    setWeaknesses(target.weaknesses);
    setBiography(target.biography);
    setPlannedTimeline(target.plannedTimeline);
    setIsFavorite(target.isFavorite);
    setExtraNotes(target.extraNotes);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

  return {
    currentCharacterId,
    retainPersistedCharacterId,
    name,
    setName,
    title,
    setTitle,
    description,
    setDescription,
    gender,
    setGender,
    race,
    setRace,
    subrace,
    setSubrace,
    personality,
    setPersonality,
    motivation,
    setMotivation,
    qualities,
    setQualities,
    weaknesses,
    setWeaknesses,
    biography,
    setBiography,
    plannedTimeline,
    setPlannedTimeline,
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

export type CharacterFormState = ReturnType<typeof useCharacterFormState>;
