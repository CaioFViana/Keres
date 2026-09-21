import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useDurableFormDraft } from '../../hooks/useDurableFormDraft';
import type { createPlotService } from '../../services/storymanagement/PlotService';

type PlotService = ReturnType<typeof createPlotService>;

type UsePlotFormStateOptions = {
  plotId?: string;
  storyId?: string;
  plotServiceRef: RefObject<PlotService | null>;
};

export type PlotFormDraftFields = {
  name: string;
  details: string;
};

const CREATE_PRISTINE: PlotFormDraftFields = {
  name: '',
  details: '',
};

function isPlotFormDraftFields(value: unknown): value is PlotFormDraftFields {
  if (!value || typeof value !== 'object') return false;
  const fields = value as Record<string, unknown>;
  return typeof fields.name === 'string' && typeof fields.details === 'string';
}

/** Owns field state and initial plot hydration for a Plot form. */
export function usePlotFormState({ plotId, storyId, plotServiceRef }: UsePlotFormStateOptions) {
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(!!plotId);
  // Edit-mode pristine values + stale guard, captured once from the loaded row (never from the
  // live fields, which a restored draft would contaminate).
  const [loadedPristine, setLoadedPristine] = useState<PlotFormDraftFields | null>(null);
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const isEditing = !!plotId;

  const [prevPlotId, setPrevPlotId] = useState(plotId);
  if (plotId !== prevPlotId) {
    setPrevPlotId(plotId);
    if (!plotId) {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadPlot = async () => {
      if (!plotServiceRef.current || !plotId) {
        setLoading(false);
        return;
      }
      try {
        const plot = await plotServiceRef.current.getById(plotId);
        if (plot) {
          setName(plot.name);
          setDetails(plot.details ?? '');
          setLoadedPristine({ name: plot.name, details: plot.details ?? '' });
          setLoadedUpdatedAt(plot.updatedAt?.toISOString?.() ?? null);
        }
      } catch (error) {
        console.error('Failed to load plot:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadPlot();
  }, [plotId, plotServiceRef]);

  const restoreDraftFields = useCallback((fields: PlotFormDraftFields) => {
    if (!isPlotFormDraftFields(fields)) {
      console.error('Corrupt plot form draft ignored.');
      return;
    }
    setName(fields.name);
    setDetails(fields.details);
  }, []);

  // Keyed by the id the form OPENED with, never the retained one: after the base row is created
  // mid-session the draft stays under `new` until the save succeeds and clears it.
  const { clearFormDraft, deleteStoredDraft, draftRestored } =
    useDurableFormDraft<PlotFormDraftFields>({
      storyId,
      entityType: 'Plot',
      entityId: plotId,
      enabled: !!storyId && !loading,
      snapshot: { name, details },
      pristine: loadedPristine ?? CREATE_PRISTINE,
      baseUpdatedAt: plotId ? loadedUpdatedAt : undefined,
      onRestore: restoreDraftFields,
    });

  const pristineFields = loadedPristine ?? CREATE_PRISTINE;
  const isDirty =
    JSON.stringify({ name, details }) !== JSON.stringify(pristineFields);

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
    plotId,
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

export type PlotFormState = ReturnType<typeof usePlotFormState>;
