import { useEffect } from 'react';
import type { AppDrizzleClient } from '../db';
import { refreshPlanUsage } from '../services/PlanUsageService';
import { usePlanUsageStore } from '../state/planUsageStore';
import { entityEventEmitter } from '../utils/EventEmitter';

/** Edits come in bursts (a form saving several rows): one look at the plan after they settle. */
const SETTLE_MS = 2000;

/**
 * Keeps the plan usage of the open story current: looked at when the story opens, and again shortly after
 * its operation log changes (a local write, or something a sync brought in). Mounted once, app-wide - the
 * editor's indicator and the alert notification both depend on it, wherever the user is in the story.
 */
export function usePlanUsageWatcher(
  db: AppDrizzleClient | null | undefined,
  story: { id: string; serverId?: string | null } | null | undefined,
): void {
  const storyId = story?.id;
  const serverId = story?.serverId;

  useEffect(() => {
    if (!db || !storyId) {
      usePlanUsageStore.getState().clear();
      return undefined;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const look = () => {
      if (!cancelled) void refreshPlanUsage(db, { id: storyId, serverId });
    };
    const onOperationLogUpdated = (changedStoryId?: string) => {
      if (changedStoryId && changedStoryId !== storyId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(look, SETTLE_MS);
    };

    look();
    entityEventEmitter.on('operation_log_updated', onOperationLogUpdated);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      entityEventEmitter.off('operation_log_updated', onOperationLogUpdated);
    };
  }, [db, storyId, serverId]);
}
