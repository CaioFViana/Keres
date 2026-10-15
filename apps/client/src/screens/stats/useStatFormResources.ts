import { useEffect, useRef } from 'react';
import { useDrizzle } from '@/src/db';
import { useStoryStats } from '@/src/hooks/useStoryStats';
import { createStatService, type StatService } from '@/src/services/storymanagement/StatService';

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
