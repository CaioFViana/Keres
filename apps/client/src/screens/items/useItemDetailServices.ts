import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createCharacterService } from '@/src/services/storymanagement/entities/CharacterService';
import { createItemService } from '@/src/services/storymanagement/entities/ItemService';

/** The services the item detail talks to: the record, and the characters that may own it. */
export function useItemDetailServices() {
  const drizzleDb = useDrizzle();
  return useMemo(
    () => ({
      itemService: createItemService(drizzleDb),
      characterService: createCharacterService(drizzleDb),
    }),
    [drizzleDb],
  );
}
