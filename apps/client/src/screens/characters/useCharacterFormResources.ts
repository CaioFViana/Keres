import { useEffect, useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createCharacterRelationService,
  type CharacterRelationServiceInterface,
} from '@/src/services/storymanagement/CharacterRelationService';
import { createCharacterService } from '@/src/services/storymanagement/CharacterService';

/** Owns the character and character-relation services used by the form. */
export function useCharacterFormResources() {
  const drizzleDb = useDrizzle();
  const characterServiceRef = useRef<ReturnType<typeof createCharacterService> | null>(null);
  const characterRelationServiceRef = useRef<CharacterRelationServiceInterface | null>(null);

  useEffect(() => {
    characterServiceRef.current ??= createCharacterService(drizzleDb);
    characterRelationServiceRef.current ??= createCharacterRelationService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    characterServiceRef,
    characterRelationServiceRef,
  };
}
