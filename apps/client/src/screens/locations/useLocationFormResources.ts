import { useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createLocationRelationService,
  type LocationRelationService,
} from '@/src/services/storymanagement/relations/LocationRelationService';
import { createLocationService } from '@/src/services/storymanagement/entities/LocationService';

/** Owns the location and location-relation services used by the form. */
export function useLocationFormResources() {
  const drizzleDb = useDrizzle();
  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null);
  const locationRelationServiceRef = useRef<LocationRelationService | null>(null);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  locationServiceRef.current ??= createLocationService(drizzleDb);
  locationRelationServiceRef.current ??= createLocationRelationService(drizzleDb);

  return {
    drizzleDb,
    locationServiceRef,
    locationRelationServiceRef,
  };
}
