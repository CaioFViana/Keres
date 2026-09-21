import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
import type { createRouteService } from '../../services/storymanagement/RouteService';

type RouteService = ReturnType<typeof createRouteService>;

type UseRouteFormStateOptions = {
  routeId?: string;
  storyId?: string;
  routeServiceRef: RefObject<RouteService | null>;
};

export type RouteFormDraftFields = {
  name: string;
  details: string;
};

const CREATE_PRISTINE: RouteFormDraftFields = {
  name: '',
  details: '',
};

function isRouteFormDraftFields(value: unknown): value is RouteFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return typeof fields.name === 'string' && typeof fields.details === 'string';
}

/** Owns field state and initial route hydration for a Route form. */
export function useRouteFormState({ routeId, storyId, routeServiceRef }: UseRouteFormStateOptions) {
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(Boolean(routeId));
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<RouteFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const isEditing = !!routeId;

  const [prevRouteId, setPrevRouteId] = useState(routeId);
  if (routeId !== prevRouteId) {
    setPrevRouteId(routeId);
    if (!routeId) {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!routeId) {
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
          setLoadedPristine({ name: route.name, details: route.details ?? '' });
          setLoadedUpdatedAt(route.updatedAt?.toISOString?.() ?? null);
        }
      })
      .finally(() => setLoading(false));
  }, [routeId, routeServiceRef]);

  const restoreDraftFields = useCallback((fields: RouteFormDraftFields) => {
    if (!isRouteFormDraftFields(fields)) {
      console.error('Corrupt route form draft ignored.');
      return;
    }
    setName(fields.name);
    setDetails(fields.details);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<RouteFormDraftFields>({
      storyId,
      entityType: 'Route',
      entityId: routeId,
      enabled: !!storyId && !loading,
      snapshot: { name, details },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: routeId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty = JSON.stringify({ name, details }) !== JSON.stringify(pristineFields);

  /**
   * Back to blanks (create) or saved values (edit), dropping the stored draft. Tracking stays
   * armed: typing afterwards drafts again.
   */
  const resetForm = useCallback(async () => {
    const target = loadedPristine ?? CREATE_PRISTINE;
    setName(target.name);
    setDetails(target.details);
    await deleteStoredDraft();
  }, [loadedPristine, deleteStoredDraft]);

  return {
    routeId,
    name,
    setName,
    details,
    setDetails,
    loading,
    isEditing,
    clearFormDraft,
    draftRestored,
    isDirty,
    resetForm,
  };
}

export type RouteFormState = ReturnType<typeof useRouteFormState>;
