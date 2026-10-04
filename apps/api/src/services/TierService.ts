import type { PartialTier, TierCreateInput } from '@keres/shared';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import { paymentSubscriptions, tiers, users } from '../db/schema';
import { effectiveDefaultTierId, isSettingDefaultTier, setDefaultTier } from './defaultTier';

export class TierNotFoundError extends Error {
  constructor() {
    super('Tier not found.');
    this.name = 'TierNotFoundError';
  }
}

export class TierNameAlreadyTakenError extends Error {
  constructor() {
    super('A tier with this name already exists.');
    this.name = 'TierNameAlreadyTakenError';
  }
}

/** Refuses to delete a tier still in use, so users/config are not left pointing at a dead id. */
/**
 * Refuses a store product id another plan already uses: the relay maps a purchase token back to
 * its plan by that id, so two plans sharing one would both accept the same purchase.
 */
export class TierPlayProductAlreadyUsedError extends Error {
  constructor(productId: string) {
    super(`Another tier already sells the store product "${productId}".`);
    this.name = 'TierPlayProductAlreadyUsedError';
  }
}

export class TierInUseError extends Error {
  constructor(reason: string) {
    super(`Cannot delete tier: ${reason}`);
    this.name = 'TierInUseError';
  }
}

export class TierService {
  async list(includeDeleted = false) {
    return db.query.tiers.findMany({
      where: includeDeleted ? undefined : eq(tiers.isDeleted, false),
      orderBy: (t, { asc }) => [asc(t.name)],
    });
  }

  /** Tiers the landing page may show: for sale, not deleted, in display order. */
  async listPublicForSale() {
    return db.query.tiers.findMany({
      where: and(eq(tiers.isDeleted, false), eq(tiers.isPublicForSale, true)),
      orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.name)],
    });
  }

  async getById(id: string) {
    return db.query.tiers.findFirst({ where: eq(tiers.id, id) });
  }

  async create(input: TierCreateInput) {
    const existing = await db.query.tiers.findFirst({ where: eq(tiers.name, input.name) });
    if (existing) {
      throw new TierNameAlreadyTakenError();
    }
    await this.rejectTakenPlayProducts(null, [
      input.playMonthlyProductId,
      input.playYearlyProductId,
    ]);
    const [created] = await db
      .insert(tiers)
      .values({ id: ulid(), ...input })
      .returning();
    // Ticking "default" on a plan makes it the default for real, and the one that was is no longer.
    if (created.isDefault) {
      await setDefaultTier(created.id);
    }
    return created;
  }

  async update(id: string, patch: PartialTier) {
    const existing = await db.query.tiers.findFirst({ where: eq(tiers.id, id) });
    if (!existing) {
      throw new TierNotFoundError();
    }
    if (patch.name && patch.name !== existing.name) {
      const nameTaken = await db.query.tiers.findFirst({ where: eq(tiers.name, patch.name) });
      if (nameTaken) {
        throw new TierNameAlreadyTakenError();
      }
    }
    if (patch.playMonthlyProductId !== undefined || patch.playYearlyProductId !== undefined) {
      await this.rejectTakenPlayProducts(id, [
        patch.playMonthlyProductId !== undefined
          ? patch.playMonthlyProductId
          : existing.playMonthlyProductId,
        patch.playYearlyProductId !== undefined
          ? patch.playYearlyProductId
          : existing.playYearlyProductId,
      ]);
    }
    const [updated] = await db
      .update(tiers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(tiers.id, id))
      .returning();
    if (patch.isDefault === true) {
      await setDefaultTier(id);
    } else if (patch.isDefault === false && (await isSettingDefaultTier(id))) {
      // Unticking the plan that is the default leaves the server with none - said by the administrators' warning.
      await setDefaultTier(null);
    }
    return { ...updated, isDefault: patch.isDefault ?? updated.isDefault };
  }

  async softDelete(id: string) {
    const existing = await db.query.tiers.findFirst({ where: eq(tiers.id, id) });
    if (!existing) {
      throw new TierNotFoundError();
    }

    if ((await effectiveDefaultTierId()) === id) {
      throw new TierInUseError('it is the default tier for new registrations.');
    }

    const assignedUser = await db.query.users.findFirst({
      where: and(eq(users.tierId, id), eq(users.isDeleted, false)),
      columns: { id: true },
    });
    if (assignedUser) {
      throw new TierInUseError('one or more active users are assigned to it.');
    }

    const subscription = await db.query.paymentSubscriptions.findFirst({
      where: and(
        eq(paymentSubscriptions.tierId, id),
        inArray(paymentSubscriptions.status, ['active', 'due']),
      ),
      columns: { userId: true },
    });
    if (subscription) {
      throw new TierInUseError('someone has a subscription to it.');
    }

    const [updated] = await db
      .update(tiers)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(tiers.id, id))
      .returning();
    return updated;
  }

  /**
   * A store product id names its plan: it must not already sell another plan on any period.
   * Deleted plans are out of the catalog, so their ids may be reused.
   */
  private async rejectTakenPlayProducts(
    selfId: string | null,
    candidates: (string | null | undefined)[],
  ) {
    const wanted = candidates.filter((candidate): candidate is string => !!candidate);
    if (wanted.length === 0) return;
    const others = await db.query.tiers.findMany({
      where: and(eq(tiers.isDeleted, false), selfId ? ne(tiers.id, selfId) : undefined),
      columns: { playMonthlyProductId: true, playYearlyProductId: true },
    });
    const taken = new Set(
      others.flatMap((other) => [other.playMonthlyProductId, other.playYearlyProductId]),
    );
    const clash = wanted.find((productId) => taken.has(productId));
    if (clash) {
      throw new TierPlayProductAlreadyUsedError(clash);
    }
  }
}

export const tierService = new TierService();
