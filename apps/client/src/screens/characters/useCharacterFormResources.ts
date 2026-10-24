import { useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createCharacterRelationService,
  type CharacterRelationServiceInterface,
} from '@/src/services/storymanagement/relations/CharacterRelationService';
import { createCharacterService } from '@/src/services/storymanagement/entities/CharacterService';

/** Owns the character and character-relation services used by the form. */
export function useCharacterFormResources() {
  const drizzleDb = useDrizzle();
  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);
  const characterRelationServiceRef = useRef<CharacterRelationServiceInterface | null>(null);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  characterServiceRef.current ??= createCharacterService(drizzleDb);
  characterRelationServiceRef.current ??= createCharacterRelationService(drizzleDb);

  return {
    drizzleDb,
    characterServiceRef,
    characterRelationServiceRef,
  };
}
