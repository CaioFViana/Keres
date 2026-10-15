import { type AccountPlan, getTierCountedEntityTypes, type StoryPlan } from '@keres/shared';
import { and, count, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '@/db';
import {
  comments,
  galleries,
  mediaBlobs,
  publicationLog,
  stories,
  storyInvitations,
  storyPermissions,
  storyPublications,
  tiers,
  users,
} from '@/db/schema';
import { effectiveDefaultTierId } from './defaultTier';
import { entitledTierId } from '@/services/payments/entitlement';
import { syncService } from '@/services/sync/SyncService';

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
  /**
   * The user's tier: the one their payments entitle them to, if their subscription is paid up; failing that,
   * the one an administrator assigned; failing that, the default signup tier; failing that, unlimited (`null`).
   */
  async getEffectiveTier(userId: string): Promise<TierRow | null> {
    const paidTierId = await entitledTierId(userId);
    if (paidTierId) {
      const paidTier = await db.query.tiers.findFirst({ where: eq(tiers.id, paidTierId) });
      if (paidTier) {
        return paidTier;
      }
    }

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

    const defaultTierId = await effectiveDefaultTierId();
    if (defaultTierId) {
      const tier = await db.query.tiers.findFirst({ where: eq(tiers.id, defaultTierId) });
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
   * Whether a story may put one more of its works (arcs) on the showcase. A work that already has a
   * live version takes no new slot - publishing again is a new version of it, not another work - and
   * deleting its last version gives the slot back. `maxPublishedArcs` is per story: a story is one
   * universe, and the ceiling is how many works of it are on show at once.
   */
  async assertCanPublishArc(userId: string, storyId: string, arcId: string): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || tier.maxPublishedArcs === null) {
      return;
    }
    const live = await db
      .selectDistinct({ arcId: storyPublications.arcId })
      .from(storyPublications)
      .where(and(eq(storyPublications.storyId, storyId), isNotNull(storyPublications.arcId)));
    if (live.some((row) => row.arcId === arcId)) {
      return;
    }
    if (live.length >= tier.maxPublishedArcs) {
      throw new TierLimitExceededError(
        `Published works limit reached for your plan (${tier.maxPublishedArcs} per story). Remove a work's last version first.`,
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
   * with the client, which reports the same count (`getTierCountedEntityTypes`): the Story, favorites and
   * comments are left out, and so are the links, values, parts and media files that no plan counts.
   */
  private async countEntities(storyIds: string[]): Promise<number> {
    const counted = new Set<string>(getTierCountedEntityTypes());
    const handlers = [...syncService.getEntityHandlers().values()].filter((h) =>
      counted.has(h.entityName),
    );
    const counts = await Promise.all(handlers.map((h) => h.countForStoryIds(storyIds)));
    return counts.reduce((sum, c) => sum + c, 0);
  }

  /**
   * The live comments of one story, by anyone. Comments are not entities, so the entity ceilings never see them:
   * this is what `maxCommentsPerStory` counts. A deleted comment frees its slot.
   */
  private async countComments(storyId: string): Promise<number> {
    const [{ total }] = await db
      .select({ total: count() })
      .from(comments)
      .where(and(eq(comments.storyId, storyId), eq(comments.isDeleted, false)));
    return total;
  }

  /**
   * The live collaborators of one story, readers and writers alike. The owner has no permission row, so the owner
   * is not counted here; a pending invitation is not a collaborator yet (see `assertCanAddContributor`).
   */
  private async countContributors(storyId: string): Promise<number> {
    const [{ total }] = await db
      .select({ total: count() })
      .from(storyPermissions)
      .where(and(eq(storyPermissions.storyId, storyId), eq(storyPermissions.isDeleted, false)));
    return total;
  }

  /** The open invitations of one story: each one takes a collaborator slot as soon as it is sent. */
  private async countPendingInvitations(storyId: string): Promise<number> {
    const [{ total }] = await db
      .select({ total: count() })
      .from(storyInvitations)
      .where(eq(storyInvitations.storyId, storyId));
    return total;
  }

  /** What the person's own plan comes with and how much of it they use: the account-level view of `getEffectiveTier`. */
  async getAccountPlan(userId: string): Promise<AccountPlan> {
    const tier = await this.getEffectiveTier(userId);
    const liveStoryIds = await this.liveStoryIdsOf(userId);
    const entitiesUsedTotal =
      tier && tier.maxEntitiesTotal !== null ? await this.countEntities(liveStoryIds) : 0;
    return {
      tierName: tier?.name ?? null,
      isDefault: tier?.isDefault ?? false,
      maxStories: tier?.maxStories ?? null,
      maxEntitiesPerStory: tier?.maxEntitiesPerStory ?? null,
      maxEntitiesTotal: tier?.maxEntitiesTotal ?? null,
      maxPublicationsPerDay: tier?.maxPublicationsPerDay ?? null,
      maxPublishedArcs: tier?.maxPublishedArcs ?? null,
      maxCommentsPerStory: tier?.maxCommentsPerStory ?? null,
      maxContributorsPerStory: tier?.maxContributorsPerStory ?? null,
      storiesUsed: liveStoryIds.length,
      entitiesUsedTotal,
    };
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
    const commentsUsed =
      tier && tier.maxCommentsPerStory !== null ? await this.countComments(storyId) : 0;
    const contributorsUsed =
      tier && tier.maxContributorsPerStory !== null ? await this.countContributors(storyId) : 0;
    return {
      tierName: tier?.name ?? null,
      maxEntitiesPerStory: tier?.maxEntitiesPerStory ?? null,
      maxEntitiesTotal: tier?.maxEntitiesTotal ?? null,
      entitiesUsedTotal,
      maxCommentsPerStory: tier?.maxCommentsPerStory ?? null,
      commentsUsed,
      maxContributorsPerStory: tier?.maxContributorsPerStory ?? null,
      contributorsUsed,
    };
  }

  /**
   * Refuses one more comment on a story once its owner's plan has no room left. Comments are not entities, so
   * the entity ceilings do not see them. The room belongs to the story owner, whoever writes: every author's
   * live comments count against the owner's `maxCommentsPerStory`, not the acting user's.
   */
  async assertCanCreateComment(actingUserId: string, storyId: string): Promise<void> {
    const userId = await this.payerOf(actingUserId, storyId);
    const tier = await this.getEffectiveTier(userId);
    if (!tier || tier.maxCommentsPerStory === null) {
      return;
    }
    const total = await this.countComments(storyId);
    if (total >= tier.maxCommentsPerStory) {
      throw new TierLimitExceededError(
        `Comment limit for this story reached for your plan (${tier.maxCommentsPerStory}).`,
      );
    }
  }

  /**
   * Refuses one more collaborator on a story once its owner's plan has no room left. Readers and writers count
   * alike, the owner does not, and the room belongs to the story owner whoever sends the invitation or accepts
   * it. With `countPending` the open invitations count as taken too: sending one is what spends the room. An
   * accepted invitation is itself pending, so accepting counts the live collaborators only.
   */
  async assertCanAddContributor(
    actingUserId: string,
    storyId: string,
    options: { countPending: boolean },
  ): Promise<void> {
    const userId = await this.payerOf(actingUserId, storyId);
    const tier = await this.getEffectiveTier(userId);
    if (!tier || tier.maxContributorsPerStory === null) {
      return;
    }
    let total = await this.countContributors(storyId);
    if (options.countPending) {
      total += await this.countPendingInvitations(storyId);
    }
    if (total >= tier.maxContributorsPerStory) {
      throw new TierLimitExceededError(
        `Collaborator limit for this story reached for your plan (${tier.maxContributorsPerStory}).`,
      );
    }
  }

  /**
   * Judges an uploaded package's comments against the per-story cap before anything is written, as
   * `assertCanImportEntities` does for entities. The package is a new story of the importer, so the cap is the
   * importer's plan and nothing is held already.
   */
  async assertCanImportComments(userId: string, incoming: number): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || tier.maxCommentsPerStory === null) {
      return;
    }
    if (incoming > tier.maxCommentsPerStory) {
      throw new TierLimitExceededError(
        `This story has ${incoming} comments, more than your plan allows in one story (${tier.maxCommentsPerStory}).`,
      );
    }
  }

  /**
   * `storyId` is the story the entity is being created in; used for the per-story ceiling. `entityType` is what
   * is being created: a type no plan counts (a link, a value, a part, a media file) is never refused here.
   */
  async assertCanCreateEntity(
    actingUserId: string,
    storyId: string,
    entityType: string,
  ): Promise<void> {
    if (!new Set<string>(getTierCountedEntityTypes()).has(entityType)) {
      return;
    }
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
   * Judges an uploaded story package against the entity ceilings before anything is written: the package's
   * own entities against the ceiling of one story, and what the person has already against the total. A story
   * made offline can hold far more than the plan allows, and the creation check of the sync would only meet
   * the limit one row at a time, after the whole package was in.
   */
  async assertCanImportEntities(userId: string, incoming: number): Promise<void> {
    const tier = await this.getEffectiveTier(userId);
    if (!tier || (tier.maxEntitiesPerStory === null && tier.maxEntitiesTotal === null)) {
      return;
    }

    if (tier.maxEntitiesPerStory !== null && incoming > tier.maxEntitiesPerStory) {
      throw new TierLimitExceededError(
        `This story has ${incoming} entities, more than your plan allows in one story (${tier.maxEntitiesPerStory}).`,
      );
    }

    if (tier.maxEntitiesTotal !== null) {
      const held = await this.countEntities(await this.liveStoryIdsOf(userId));
      if (held + incoming > tier.maxEntitiesTotal) {
        throw new TierLimitExceededError(
          `This story has ${incoming} entities and you already have ${held}: together that is over your plan's total (${tier.maxEntitiesTotal}).`,
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
