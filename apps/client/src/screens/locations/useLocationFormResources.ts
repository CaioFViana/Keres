import { useEffect, useRef } from 'react';
import { useDrizzle } from '../../db';
import {
  createLocationRelationService,
  type LocationRelationService,
} from '../../services/storymanagement/LocationRelationService';
import { createLocationService } from '../../services/storymanagement/LocationService';

/** Owns the location and location-relation services used by the form. */
export function useLocationFormResources() {
  const drizzleDb = useDrizzle();
  const locationServiceRef = useRef<ReturnType<typeof createLocationService> | null>(null);
  const locationRelationServiceRef = useRef<LocationRelationService | null>(null);

  useEffect(() => {
    locationServiceRef.current ??= createLocationService(drizzleDb);
    locationRelationServiceRef.current ??= createLocationRelationService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    locationServiceRef,
    locationRelationServiceRef,
  };
}
