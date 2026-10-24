import { useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createItemService,
  type ItemService,
} from '@/src/services/storymanagement/entities/ItemService';

/** Owns the item service used by the form. */
export function useItemFormResources() {
  const drizzleDb = useDrizzle();
  const itemServiceRef = useRef<ItemService | null>(null);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  itemServiceRef.current ??= createItemService(drizzleDb);

  return {
    drizzleDb,
    itemServiceRef,
  };
}
