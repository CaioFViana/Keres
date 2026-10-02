import type { StoryPlan } from '@keres/shared';
import type { AppDrizzleClient } from '../db';
import { useNotificationStore } from '../state/notificationStore';
import { usePlanUsageStore } from '../state/planUsageStore';
import i18n from '../utils/i18n';
import { evaluatePlanUsage, type PlanUsage } from '../utils/planUsage';
import { createStoryEntityCountService } from './storymanagement/StoryEntityCountService';
import { createStoryPlanService } from './StoryPlanService';

/** The plan is the server's and changes rarely; it is read again after this long, not on every edit. */
export const PLAN_CACHE_MS = 2 * 60 * 1000;

interface CachedPlan {
  plan: StoryPlan | null;
  /** The story's own count when the plan was read: the total ceiling's usage moves with it from there. */
  storyCountAtFetch: number;
  at: number;
}

const planCache = new Map<string, CachedPlan>();
/** `storyId:scope` of the alerts already announced, so a notification comes once and not on every edit. */
const announced = new Set<string>();

/** For tests, and for the app reset: forget what was read and announced. */
export function resetPlanUsageState(): void {
  planCache.clear();
  announced.clear();
  usePlanUsageStore.getState().clear();
}

function announce(storyId: string, usage: PlanUsage): void {
  const key = `${storyId}:${usage.scope}`;
  if (usage.level !== 'alert') {
    // Back under the alert mark: the next time it is reached is news again.
    announced.delete(key);
    return;
  }
  if (announced.has(key)) return;
  announced.add(key);
  const reached = usage.used >= usage.limit;
  const message = i18n.t(`plan_usage_${reached ? 'reached' : 'toast'}_${usage.scope}`, {
    used: usage.used,
    limit: usage.limit,
  });
  useNotificationStore.getState().showNotification(message, 'warning');
}

/**
 * Looks at how close a story is to its owner's plan: the story's own count (local, so it includes what
 * has not synchronized) against the plan the server reported. The result goes to the store the editor's
 * indicator reads, and the first time a ceiling reaches the alert mark a notification says so.
 *
 * Without a plan (the story is only on this device, or the server cannot be reached and nothing was read
 * before) there is nothing to compare with and the indicator is cleared.
 */
export async function refreshPlanUsage(
  db: AppDrizzleClient,
  story: { id: string; serverId?: string | null },
  now = Date.now(),
): Promise<void> {
  if (!story.serverId) {
    usePlanUsageStore.getState().clear();
    return;
  }
  try {
    const storyCount = (await createStoryEntityCountService(db).countForStory(story.id)).total;

    let cached = planCache.get(story.id);
    if (!cached || now - cached.at >= PLAN_CACHE_MS) {
      const plan = await createStoryPlanService(db).getPlan(story.serverId, story.id);
      // Unreachable server: the last plan read is better than none.
      cached = plan ? { plan, storyCountAtFetch: storyCount, at: now } : cached;
      if (cached) planCache.set(story.id, cached);
    }
    if (!cached?.plan) {
      usePlanUsageStore.getState().clear();
      return;
    }

    const totalUsed = Math.max(
      0,
      cached.plan.entitiesUsedTotal + storyCount - cached.storyCountAtFetch,
    );
    const summary = evaluatePlanUsage(cached.plan, storyCount, totalUsed);
    usePlanUsageStore.getState().set(story.id, summary);
    for (const usage of [summary.story, summary.total]) {
      if (usage) announce(story.id, usage);
    }
  } catch (error) {
    // An indicator is not worth a failure of anything else.
    console.warn('PlanUsageService: could not look at the plan usage.', error);
  }
}
