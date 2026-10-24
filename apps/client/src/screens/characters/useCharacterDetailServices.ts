import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createCharacterSceneService } from '@/src/services/storymanagement/entities/CharacterSceneService';
import { createCharacterService } from '@/src/services/storymanagement/entities/CharacterService';
import { createCharacterRelationService } from '@/src/services/storymanagement/relations/CharacterRelationService';

/** The services the character detail itself talks to: the record, its relations, its scenes. */
export function useCharacterDetailServices() {
  const drizzleDb = useDrizzle();
  return useMemo(
    () => ({
      characterService: createCharacterService(drizzleDb),
      relationService: createCharacterRelationService(drizzleDb),
      characterSceneService: createCharacterSceneService(drizzleDb),
    }),
    [drizzleDb],
  );
}

export type CharacterDetailServices = ReturnType<typeof useCharacterDetailServices>;
