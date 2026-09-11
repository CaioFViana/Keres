import { useEffect, useRef } from 'react';
import { useDrizzle } from '../../db';
import {
  createWorldRuleService,
  type WorldRuleService,
} from '../../services/storymanagement/WorldRuleService';

/** Owns the world-rule service used by the form. */
export function useWorldRuleFormResources() {
  const drizzleDb = useDrizzle();
  const worldRuleServiceRef = useRef<WorldRuleService | null>(null);

  useEffect(() => {
    worldRuleServiceRef.current ??= createWorldRuleService(drizzleDb);
  }, [drizzleDb]);

  return {
    drizzleDb,
    worldRuleServiceRef,
  };
}
