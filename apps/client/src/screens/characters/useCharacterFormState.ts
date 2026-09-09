import type { CustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import { getDefaultCustomAttributeValues } from '@/src/components/common/forms/CustomAttributeFields/CustomAttributeFields';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppDrizzleClient } from '../../db';
import { createAttributeValueService } from '../../services/storymanagement/AttributeValueService';
import type { CharacterService } from '../../services/storymanagement/CharacterService';
import type { StorySchemaField } from '@keres/shared';

type UseCharacterFormStateOptions = {
  initialCharacterId?: string;
  storyId?: string;
  drizzleDb: AppDrizzleClient;
  characterServiceRef: RefObject<CharacterService | null>;
  customFields: StorySchemaField[];
};

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

            const existingValues = await createAttributeValueService(drizzleDb).getValuesForEntity(
              initialCharacterId,
            );
            setCustomValues(Object.fromEntries(existingValues.map((v) => [v.fieldId, v.value])));
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
  };
}

export type CharacterFormState = ReturnType<typeof useCharacterFormState>;
