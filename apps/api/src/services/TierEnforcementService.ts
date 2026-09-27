import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { galleries, mediaBlobs, registrationSettings, stories, tiers, users } from '../db/schema';
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

  /** `storyId` is the story the entity is being created in; used for the per-story ceiling. */
  async assertCanCreateEntity(actingUserId: string, storyId: string): Promise<void> {
    const userId = await this.payerOf(actingUserId, storyId);
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
