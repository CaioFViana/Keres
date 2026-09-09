import type { RefObject } from 'react';
import { useEffect, useState } from 'react';
import type { createPlotService } from '../../services/storymanagement/PlotService';

type PlotService = ReturnType<typeof createPlotService>;

type UsePlotFormStateOptions = {
  plotId?: string;
  plotServiceRef: RefObject<PlotService | null>;
};

/** Owns field state and initial plot hydration for a Plot form. */
export function usePlotFormState({ plotId, plotServiceRef }: UsePlotFormStateOptions) {
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(!!plotId);
  const isEditing = !!plotId;

  useEffect(() => {
    if (!isEditing) {
      setLoading(false);
      return;
    }

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
        }
      } catch (error) {
        console.error('Failed to load plot:', error);
      } finally {
        setLoading(false);
      }
    };
    void loadPlot();
  }, [isEditing, plotId, plotServiceRef]);

  return {
    plotId,
    name,
    setName,
    details,
    setDetails,
    loading,
    isEditing,
  };
}

export type PlotFormState = ReturnType<typeof usePlotFormState>;
