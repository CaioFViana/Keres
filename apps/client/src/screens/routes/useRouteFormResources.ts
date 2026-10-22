import { useRef } from 'react';
import { useDrizzle } from '@/src/db';
import { createRouteService } from '@/src/services/storymanagement/entities/RouteService';

/** Owns the route service used by the form. */
export function useRouteFormResources() {
  const drizzleDb = useDrizzle();
  const routeServiceRef = useRef<ReturnType<typeof createRouteService> | null>(null);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  routeServiceRef.current ??= createRouteService(drizzleDb);

  return {
    drizzleDb,
    routeServiceRef,
  };
}
