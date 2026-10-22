import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createLocationService } from '@/src/services/storymanagement/entities/LocationService';
import { createLocationRelationService } from '@/src/services/storymanagement/relations/LocationRelationService';

/** The services the location detail itself talks to: the record, and its place in the hierarchy. */
export function useLocationDetailServices() {
  const drizzleDb = useDrizzle();
  return useMemo(
    () => ({
      locationService: createLocationService(drizzleDb),
      relationService: createLocationRelationService(drizzleDb),
    }),
    [drizzleDb],
  );
}
