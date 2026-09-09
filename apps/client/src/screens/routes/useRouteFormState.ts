import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import type { createRouteService } from '../../services/storymanagement/RouteService';

type RouteService = ReturnType<typeof createRouteService>;

type UseRouteFormStateOptions = {
  routeId?: string;
  routeServiceRef: RefObject<RouteService | null>;
};

/** Owns field state and initial route hydration for a Route form. */
export function useRouteFormState({ routeId, routeServiceRef }: UseRouteFormStateOptions) {
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(Boolean(routeId));
  const isEditing = !!routeId;

  useEffect(() => {
    if (!routeId) {
      setLoading(false);
      return;
    }
    if (!routeServiceRef.current) {
      setLoading(false);
      return;
    }
    routeServiceRef.current
      .getById(routeId)
      .then((route) => {
        if (route) {
          setName(route.name);
          setDetails(route.details ?? '');
        }
      })
      .finally(() => setLoading(false));
  }, [routeId, routeServiceRef]);

  return {
    routeId,
    name,
    setName,
    details,
    setDetails,
    loading,
    isEditing,
  };
}

export type RouteFormState = ReturnType<typeof useRouteFormState>;
