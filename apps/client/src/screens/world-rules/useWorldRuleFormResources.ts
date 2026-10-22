import { useRef } from 'react';
import { useDrizzle } from '@/src/db';
import {
  createWorldRuleService,
  type WorldRuleService,
} from '@/src/services/storymanagement/entities/WorldRuleService';

/** Owns the world-rule service used by the form. */
export function useWorldRuleFormResources() {
  const drizzleDb = useDrizzle();
  const worldRuleServiceRef = useRef<WorldRuleService | null>(null);

  // Created in the first render, not after it: no screen can look for a service that is not there yet.
  worldRuleServiceRef.current ??= createWorldRuleService(drizzleDb);

  return {
    drizzleDb,
    worldRuleServiceRef,
  };
}
