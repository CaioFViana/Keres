import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { galleries, registrationSettings, stories, tiers, users } from '../db/schema';
import { syncService } from './SyncService';

/**
 * Refusal of an operation for exceeding the user's plan ceiling. Each call site decides how to
 * translate this into the appropriate error format (SyncConflictError in the sync pipeline, AppError
 * on import, a plain 403 on media upload).
 */
export class TierLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TierLimitExceededError';
  }
}

type TierRow = typeof tiers.$inferSelect;

/**
 * The server is the source of truth for plan ceilings. The checks here are done by simple counting
 * (`SELECT COUNT ...` followed by a comparison), with no lock and no dedicated transaction - there is
 * a race window where two concurrent writes right at the limit can both go through and exceed the
 * ceiling by 1. That is a deliberate choice: it is a plan ceiling, not a financial/integrity limit,
 * and the rest of the schema uses no optimistic/pessimistic locking for anything comparable. If strict
 * rigour ever becomes necessary, the fix is a `SELECT ... FOR UPDATE` per user, not new infrastructure.
 */
export class TierEnforcementService {
  /** The user's tier; failing that, the default signup tier; failing that, unlimited (`null`). */
  async getEffectiveTier(userId: string): Promise<TierRow | null> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { tierId: true },
    });
    if (user?.tierId) {
      const tier = await db.query.tiers.findFirst({ where: eq(tiers.id, user.tierId) });
      if (tier) {
        return tier;
      }
    }

    const settings = await db.query.registrationSettings.findFirst({
      where: eq(registrationSettings.id, 'singleton'),
    });
    if (settings?.defaultTierId) {
      const tier = await db.query.tiers.findFirst({ where: eq(tiers.id, settings.defaultTierId) });
      if (tier) {
        return tier;
      }
    }

    return null;
  }

  async assertCanCreateStory(userId: string): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || tier.maxStories === null) {
      return;
    }
    const [{ total }] = await db
      .select({ total: count() })
      .from(stories)
      .where(and(eq(stories.userId, userId), eq(stories.isDeleted, false)));
    if (total >= tier.maxStories) {
      throw new TierLimitExceededError(`Story limit reached for your plan (${tier.maxStories}).`);
    }
  }

  /** `storyId` is the story the entity is being created in; used for the per-story ceiling. */
  async assertCanCreateEntity(userId: string, storyId: string): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || (tier.maxEntitiesPerStory === null && tier.maxEntitiesTotal === null)) {
      return;
    }

    const handlers = [...syncService.getEntityHandlers().values()]
      // Favorite and Comment are personal metadata/annotations, not story content - they must neither
      // consume nor be blocked by the tier's entity limit.
      .filter(
        (h) =>
          h.entityName !== 'Story' && h.entityName !== 'Favorite' && h.entityName !== 'Comment',
      );

    if (tier.maxEntitiesPerStory !== null) {
      const counts = await Promise.all(handlers.map((h) => h.countForStoryIds([storyId])));
      const total = counts.reduce((sum, c) => sum + c, 0);
      if (total >= tier.maxEntitiesPerStory) {
        throw new TierLimitExceededError(
          `Entity limit for this story reached for your plan (${tier.maxEntitiesPerStory}).`,
        );
      }
    }

    if (tier.maxEntitiesTotal !== null) {
      const userStories = await db.query.stories.findMany({
        where: and(eq(stories.userId, userId), eq(stories.isDeleted, false)),
        columns: { id: true },
      });
      const storyIds = userStories.map((s) => s.id);
      const counts = await Promise.all(handlers.map((h) => h.countForStoryIds(storyIds)));
      const total = counts.reduce((sum, c) => sum + c, 0);
      if (total >= tier.maxEntitiesTotal) {
        throw new TierLimitExceededError(
          `Total entity limit reached for your plan (${tier.maxEntitiesTotal}).`,
        );
      }
    }
  }

  /**
   * It sums `galleries.sizeBytes` (not `mediaBlobs.sizeBytes`): the blob is deduplicated globally, so
   * two stories referencing the same hash have to count the bytes once each (that is what they "use"),
   * not once in the server's total.
   */
  async assertCanUploadMedia(
    userId: string,
    storyId: string,
    incomingBytes: number,
  ): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || (tier.maxStorageBytesPerStory === null && tier.maxStorageBytesTotal === null)) {
      return;
    }

    if (tier.maxStorageBytesPerStory !== null) {
      // Deliberately without a cast: an `::int` would overflow ("integer out of range" - Postgres does not
      // truncate silently) as soon as a story's total went past ~2.1 GB, breaking every upload for it with
      // an opaque 500. It is not hypothetical: a tier's *limit* is capped at that by the column's type, but
      // actual usage is not. Postgres returns an integer `sum` as a bigint (a string) and SQLite as a
      // number, which is why `Number(...)` serves both.
      const [{ used }] = await db
        .select({ used: sql<string | number>`coalesce(sum(${galleries.sizeBytes}), 0)` })
        .from(galleries)
        .where(and(eq(galleries.storyId, storyId), eq(galleries.isDeleted, false)));
      if (Number(used) + incomingBytes > tier.maxStorageBytesPerStory) {
        throw new TierLimitExceededError(
          `Storage limit for this story reached for your plan (${tier.maxStorageBytesPerStory} bytes).`,
        );
      }
    }

    if (tier.maxStorageBytesTotal !== null) {
      const [{ used }] = await db
        .select({ used: sql<string | number>`coalesce(sum(${galleries.sizeBytes}), 0)` })
        .from(galleries)
        .innerJoin(stories, eq(galleries.storyId, stories.id))
        .where(and(eq(stories.userId, userId), eq(galleries.isDeleted, false)));
      if (Number(used) + incomingBytes > tier.maxStorageBytesTotal) {
        throw new TierLimitExceededError(
          `Total storage limit reached for your plan (${tier.maxStorageBytesTotal} bytes).`,
        );
      }
    }
  }
}

export const tierEnforcementService = new TierEnforcementService();
