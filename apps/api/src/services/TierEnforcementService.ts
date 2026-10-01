import { type StoryPlan, TIER_EXEMPT_ENTITY_TYPES } from '@keres/shared';
import { and, count, eq, gte, lt, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import {
  galleries,
  mediaBlobs,
  publicationLog,
  registrationSettings,
  stories,
  tiers,
  users,
} from '../db/schema';
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

  /**
   * Refuses a publication once the user has made their plan's number of them in the last 24 hours.
   * A rolling window, not a calendar day: it needs no time zone and does not hand out a fresh
   * allowance at midnight. Counted from `publication_log`, which deleting a version does not touch.
   */
  async assertCanPublish(userId: string, now = new Date()): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || tier.maxPublicationsPerDay === null) {
      return;
    }
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const [{ total }] = await db
      .select({ total: count() })
      .from(publicationLog)
      .where(and(eq(publicationLog.userId, userId), gte(publicationLog.createdAt, since)));
    if (total >= tier.maxPublicationsPerDay) {
      throw new TierLimitExceededError(
        `Publication limit reached for your plan (${tier.maxPublicationsPerDay} per day). Try again later.`,
      );
    }
  }

  /**
   * Notes a publication for the daily count, and drops entries too old to matter (a day is all the
   * window ever looks at; the second one is slack). Runs in the publishing transaction, so a
   * publication that fails is not counted.
   */
  async recordPublication(
    runner: Pick<typeof db, 'insert' | 'delete'>,
    userId: string,
    storyId: string,
    now = new Date(),
  ): Promise<void> {
    await runner.insert(publicationLog).values({ id: ulid(), userId, storyId, createdAt: now });
    await runner
      .delete(publicationLog)
      .where(lt(publicationLog.createdAt, new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)));
  }

  /**
   * Whose plan a story's content counts against: its owner's, whoever is writing. Charging the
   * acting user let a writer's entities and bytes count toward nobody's total - a collaborator
   * account was all it took to go past the owner's ceiling. Falls back to the acting user for a
   * story that does not exist yet.
   */
  private async payerOf(actingUserId: string, storyId: string): Promise<string> {
    const story = await db.query.stories.findFirst({
      where: eq(stories.id, storyId),
      columns: { userId: true },
    });
    return story?.userId ?? actingUserId;
  }

  private async liveStoryIdsOf(userId: string): Promise<string[]> {
    const userStories = await db.query.stories.findMany({
      where: and(eq(stories.userId, userId), eq(stories.isDeleted, false)),
      columns: { id: true },
    });
    return userStories.map((s) => s.id);
  }

  /**
   * The live entities of these stories as the plan's entity ceilings count them. The rule is shared
   * with the client, which reports the same count (TIER_EXEMPT_ENTITY_TYPES says why Favorite and
   * Comment are out).
   */
  private async countEntities(storyIds: string[]): Promise<number> {
    const handlers = [...syncService.getEntityHandlers().values()].filter(
      (h) => !TIER_EXEMPT_ENTITY_TYPES.includes(h.entityName),
    );
    const counts = await Promise.all(handlers.map((h) => h.countForStoryIds(storyIds)));
    return counts.reduce((sum, c) => sum + c, 0);
  }

  /**
   * The entity ceilings of a story's owner and how much of the total one the owner has used, for the
   * client to show next to what it counts itself. Unlimited (no tier) is all `null`.
   */
  async getStoryPlan(storyId: string): Promise<StoryPlan> {
    const ownerId = await this.payerOf('', storyId);
    const tier = await this.getEffectiveTier(ownerId);
    const entitiesUsedTotal =
      tier && tier.maxEntitiesTotal !== null
        ? await this.countEntities(await this.liveStoryIdsOf(ownerId))
        : 0;
    return {
      tierName: tier?.name ?? null,
      maxEntitiesPerStory: tier?.maxEntitiesPerStory ?? null,
      maxEntitiesTotal: tier?.maxEntitiesTotal ?? null,
      entitiesUsedTotal,
    };
  }

  /** `storyId` is the story the entity is being created in; used for the per-story ceiling. */
  async assertCanCreateEntity(actingUserId: string, storyId: string): Promise<void> {
    const userId = await this.payerOf(actingUserId, storyId);
    const tier = await this.getEffectiveTier(userId);
    if (!tier || (tier.maxEntitiesPerStory === null && tier.maxEntitiesTotal === null)) {
      return;
    }

    if (tier.maxEntitiesPerStory !== null) {
      const total = await this.countEntities([storyId]);
      if (total >= tier.maxEntitiesPerStory) {
        throw new TierLimitExceededError(
          `Entity limit for this story reached for your plan (${tier.maxEntitiesPerStory}).`,
        );
      }
    }

    if (tier.maxEntitiesTotal !== null) {
      const total = await this.countEntities(await this.liveStoryIdsOf(userId));
      if (total >= tier.maxEntitiesTotal) {
        throw new TierLimitExceededError(
          `Total entity limit reached for your plan (${tier.maxEntitiesTotal}).`,
        );
      }
    }
  }

  /**
   * Storage a set of live gallery rows uses. Each row counts once per story that references it
   * (the blob is deduplicated globally, but each story "uses" its bytes), and at the blob's TRUE
   * size once the bytes are stored - the size a client declares in the row only stands in until
   * then. Counting declared sizes alone let a row declare 0 bytes and upload 50 MB, over and over.
   *
   * Deliberately without a cast: an `::int` would overflow ("integer out of range" - Postgres does
   * not truncate silently) past ~2.1 GB. Postgres returns an integer `sum` as a bigint (a string)
   * and SQLite as a number, which is why `Number(...)` serves both.
   */
  private async storageUsed(scope: { storyId: string } | { ownerId: string }): Promise<number> {
    const size = sql<
      string | number
    >`coalesce(sum(coalesce(${mediaBlobs.sizeBytes}, ${galleries.sizeBytes})), 0)`;
    const [{ used }] =
      'storyId' in scope
        ? await db
            .select({ used: size })
            .from(galleries)
            .leftJoin(mediaBlobs, eq(mediaBlobs.hash, galleries.hash))
            .where(and(eq(galleries.storyId, scope.storyId), eq(galleries.isDeleted, false)))
        : await db
            .select({ used: size })
            .from(galleries)
            .innerJoin(stories, eq(galleries.storyId, stories.id))
            .leftJoin(mediaBlobs, eq(mediaBlobs.hash, galleries.hash))
            .where(and(eq(stories.userId, scope.ownerId), eq(galleries.isDeleted, false)));
    return Number(used);
  }

  /** Refuses `incomingBytes` more on the story, against its owner's per-story and total ceilings. */
  async assertCanUploadMedia(
    actingUserId: string,
    storyId: string,
    incomingBytes: number,
  ): Promise<void> {
    const ownerId = await this.payerOf(actingUserId, storyId);
    const tier = await this.getEffectiveTier(ownerId);
    if (!tier || (tier.maxStorageBytesPerStory === null && tier.maxStorageBytesTotal === null)) {
      return;
    }
    if (incomingBytes <= 0) return;

    if (tier.maxStorageBytesPerStory !== null) {
      const used = await this.storageUsed({ storyId });
      if (used + incomingBytes > tier.maxStorageBytesPerStory) {
        throw new TierLimitExceededError(
          `Storage limit for this story reached for your plan (${tier.maxStorageBytesPerStory} bytes).`,
        );
      }
    }

    if (tier.maxStorageBytesTotal !== null) {
      const used = await this.storageUsed({ ownerId });
      if (used + incomingBytes > tier.maxStorageBytesTotal) {
        throw new TierLimitExceededError(
          `Total storage limit reached for your plan (${tier.maxStorageBytesTotal} bytes).`,
        );
      }
    }
  }

  /**
   * The upload of a blob's bytes: only for a hash some live gallery row of this story references
   * (the client synchronizes the metadata first), charged at the uploaded size in place of what
   * those rows declared. Unreferenced uploads were bytes no ledger ever counted.
   */
  async assertCanStoreBlob(
    actingUserId: string,
    storyId: string,
    hash: string,
    sizeBytes: number,
  ): Promise<void> {
    const referencing = await db
      .select({ sizeBytes: galleries.sizeBytes })
      .from(galleries)
      .where(
        and(
          eq(galleries.storyId, storyId),
          eq(galleries.hash, hash),
          eq(galleries.isDeleted, false),
        ),
      );
    if (referencing.length === 0) {
      throw new BlobNotReferencedError(hash);
    }
    const stored = await db.query.mediaBlobs.findFirst({
      where: eq(mediaBlobs.hash, hash),
      columns: { hash: true },
    });
    // Already stored: the ledger counts its true size for these rows already.
    if (stored) return;
    const declared = referencing.reduce((sum, row) => sum + row.sizeBytes, 0);
    await this.assertCanUploadMedia(
      actingUserId,
      storyId,
      referencing.length * sizeBytes - declared,
    );
  }
}

/** An upload of bytes no media file of the story refers to. */
export class BlobNotReferencedError extends Error {
  constructor(hash: string) {
    super(`No media file of this story refers to ${hash}; synchronize its metadata first.`);
    this.name = 'BlobNotReferencedError';
  }
}

export const tierEnforcementService = new TierEnforcementService();
