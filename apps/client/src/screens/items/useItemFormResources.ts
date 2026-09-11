import { useEffect, useRef } from 'react';
import { useDrizzle } from '../../db';
import { createItemService, type ItemService } from '../../services/storymanagement/ItemService';

/** Owns the item service used by the form. */
export function useItemFormResources() {
  const drizzleDb = useDrizzle();
  const itemServiceRef = useRef<ItemService | null>(null);

  useEffect(() => {
    itemServiceRef.current ??= createItemService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    itemServiceRef,
  };
}
