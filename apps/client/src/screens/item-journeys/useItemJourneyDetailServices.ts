import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createItemJourneyService } from '@/src/services/storymanagement/entities/ItemJourneyService';

/** The service the item journey detail reads its record from. */
export function useItemJourneyDetailServices() {
  const drizzleDb = useDrizzle();
  return useMemo(() => ({ itemJourneyService: createItemJourneyService(drizzleDb) }), [drizzleDb]);
}
