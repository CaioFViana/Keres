import { useRef } from 'react';
import { useDrizzle } from '@/src/db';
import { useStoryStats } from '@/src/hooks/story/useStoryStats';
import {
  createStatService,
  type StatService,
} from '@/src/services/storymanagement/choices-stats/StatService';

/** Owns the stat service and story-scoped stats lookup used by the form. */
export function useStatFormResources(storyId?: string) {
  const drizzleDb = useDrizzle();
  const statServiceRef = useRef<StatService | null>(null);
  const data = useStoryStats(storyId);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  statServiceRef.current ??= createStatService(drizzleDb);

  return {
    drizzleDb,
    statServiceRef,
    data,
  };
}
