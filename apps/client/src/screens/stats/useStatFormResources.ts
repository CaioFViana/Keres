import { useEffect, useRef } from 'react';
import { useDrizzle } from '../../db';
import { useStoryStats } from '../../hooks/useStoryStats';
import { createStatService, type StatService } from '../../services/storymanagement/StatService';

/** Owns the stat service and story-scoped stats lookup used by the form. */
export function useStatFormResources(storyId?: string) {
  const drizzleDb = useDrizzle();
  const statServiceRef = useRef<StatService | null>(null);
  const data = useStoryStats(storyId);

  useEffect(() => {
    statServiceRef.current ??= createStatService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    statServiceRef,
    data,
  };
}
