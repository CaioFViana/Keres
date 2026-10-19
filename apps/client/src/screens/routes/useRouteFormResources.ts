import { useEffect, useRef } from 'react';
import { useDrizzle } from '@/src/db';
import { createRouteService } from '@/src/services/storymanagement/entities/RouteService';

/** Owns the route service used by the form. */
export function useRouteFormResources() {
  const drizzleDb = useDrizzle();
  const routeServiceRef = useRef<ReturnType<typeof createRouteService> | null>(null);

  useEffect(() => {
    routeServiceRef.current ??= createRouteService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    routeServiceRef,
  };
}
