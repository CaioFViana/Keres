import type { PartialTier, TierCreateInput } from '@keres/shared';
import { and, eq } from 'drizzle-orm';
import { ulid } from 'ulid';
import { db } from '../db';
import { registrationSettings, tiers, users } from '../db/schema';

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

/** Recusa excluir um tier ainda em uso, para não deixar usuários/config apontando para um id morto. */
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

  async getById(id: string) {
    return db.query.tiers.findFirst({ where: eq(tiers.id, id) });
  }

  async create(input: TierCreateInput) {
    const existing = await db.query.tiers.findFirst({ where: eq(tiers.name, input.name) });
    if (existing) {
      throw new TierNameAlreadyTakenError();
    }
    const [created] = await db
      .insert(tiers)
      .values({ id: ulid(), ...input })
      .returning();
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
    const [updated] = await db
      .update(tiers)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(tiers.id, id))
      .returning();
    return updated;
  }

  async softDelete(id: string) {
    const existing = await db.query.tiers.findFirst({ where: eq(tiers.id, id) });
    if (!existing) {
      throw new TierNotFoundError();
    }

    const defaultingSettings = await db.query.registrationSettings.findFirst({
      where: eq(registrationSettings.defaultTierId, id),
    });
    if (defaultingSettings) {
      throw new TierInUseError('it is the default tier for new registrations.');
    }

    const assignedUser = await db.query.users.findFirst({
      where: and(eq(users.tierId, id), eq(users.isDeleted, false)),
      columns: { id: true },
    });
    if (assignedUser) {
      throw new TierInUseError('one or more active users are assigned to it.');
    }

    const [updated] = await db
      .update(tiers)
      .set({ isDeleted: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(tiers.id, id))
      .returning();
    return updated;
  }
}

export const tierService = new TierService();
