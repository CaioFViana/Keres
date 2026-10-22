import { useMemo } from 'react';
import { useDrizzle } from '@/src/db';
import { createWorldRuleService } from '@/src/services/storymanagement/entities/WorldRuleService';

/** The service the world rule detail reads its record (tags included) from. */
export function useWorldRuleDetailServices() {
  const drizzleDb = useDrizzle();
  return useMemo(() => ({ worldRuleService: createWorldRuleService(drizzleDb) }), [drizzleDb]);
}
