import { MAX_PRIMARY_STATS, type CreateStoryUpdate, type UpdateStoryUpdate } from '@keres/shared';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db';
import {
  characters,
  modes,
  statRelations,
  statStrengths,
  stats,
  stories,
  users,
} from '../../src/db/schema';
import { SyncConflictError } from '../../src/services/entity-sync-handlers/BaseSyncEntityHandler';
import { ModeSyncHandler } from '../../src/services/entity-sync-handlers/ModeSyncHandler';
import { StatRelationSyncHandler } from '../../src/services/entity-sync-handlers/StatRelationSyncHandler';
import { StatStrengthSyncHandler } from '../../src/services/entity-sync-handlers/StatStrengthSyncHandler';
import { StatSyncHandler } from '../../src/services/entity-sync-handlers/StatSyncHandler';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

/**
 * As invariantes do sistema de status não cabem em constraint de banco: `stat_id` e `mode_id`
 * são anuláveis, e no Postgres NULLs são distintos entre si, então um índice único deixaria
 * passar justamente as colisões da escada padrão e do modo normal. Quem garante é o handler,
 * e é ele que este arquivo exercita.
 */
const statHandler = new StatSyncHandler();
const strengthHandler = new StatStrengthSyncHandler();
const valueHandler = new StatRelationSyncHandler();
const modeHandler = new ModeSyncHandler();

const create = (entity: string, id: string, data: Record<string, unknown>) =>
  ({ type: 'create', entity, id, data }) as CreateStoryUpdate;
const change = (entity: string, id: string, changes: Record<string, unknown>) =>
  ({ type: 'update', entity, id, changes }) as UpdateStoryUpdate;

let userId: string;
let storyId: string;
let characterId: string;
let otherCharacterId: string;
let statId: string;

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  characterId = newId();
  otherCharacterId = newId();
  statId = newId();

  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'A Queda',
    type: 'linear',
    statSystem: true,
  } as never);
  await db.insert(characters).values([
    { id: characterId, storyId, name: 'Ilda' },
    { id: otherCharacterId, storyId, name: 'Bento' },
  ] as never);
  await statHandler.create(userId, storyId, create('Stat', statId, { name: 'Coragem' }));
});

describe('Stat', () => {
  it('creates a primary stat by default', async () => {
    const row = await statHandler.findById(statId);

    expect(row).toMatchObject({ name: 'Coragem', isPrimary: true, storyId });
  });

  it('refuses the thirteenth primary stat', async () => {
    for (let index = 1; index < MAX_PRIMARY_STATS; index += 1) {
      await statHandler.create(userId, storyId, create('Stat', newId(), { name: `Stat ${index}` }));
    }

    await expect(
      statHandler.create(userId, storyId, create('Stat', newId(), { name: 'Excedente' })),
    ).rejects.toThrow(SyncConflictError);
  });

  it('accepts secondary stats beyond the primary limit', async () => {
    for (let index = 1; index < MAX_PRIMARY_STATS; index += 1) {
      await statHandler.create(userId, storyId, create('Stat', newId(), { name: `Stat ${index}` }));
    }
    const secondaryId = newId();

    await statHandler.create(
      userId,
      storyId,
      create('Stat', secondaryId, { name: 'Reputação', isPrimary: false }),
    );

    expect((await statHandler.findById(secondaryId)).isPrimary).toBe(false);
  });

  it('refuses to promote a secondary stat when the primaries are full', async () => {
    const secondaryId = newId();
    await statHandler.create(
      userId,
      storyId,
      create('Stat', secondaryId, { name: 'Reputação', isPrimary: false }),
    );
    for (let index = 1; index < MAX_PRIMARY_STATS; index += 1) {
      await statHandler.create(userId, storyId, create('Stat', newId(), { name: `Stat ${index}` }));
    }
    const current = await statHandler.findById(secondaryId);

    await expect(
      statHandler.update(
        userId,
        storyId,
        change('Stat', secondaryId, { version: current.version, isPrimary: true }),
        current,
      ),
    ).rejects.toThrow(SyncConflictError);
  });
});

describe('StatStrength', () => {
  it('keeps the story default ladder and a stat override apart', async () => {
    const defaultTier = newId();
    const statTier = newId();

    await strengthHandler.create(
      userId,
      storyId,
      create('StatStrength', defaultTier, { label: 'F', minValue: 0 }),
    );
    // Mesmo piso, escada diferente: não é colisão.
    await strengthHandler.create(
      userId,
      storyId,
      create('StatStrength', statTier, { statId, label: 'F', minValue: 0 }),
    );

    expect((await strengthHandler.findById(defaultTier)).statId).toBeNull();
    expect((await strengthHandler.findById(statTier)).statId).toBe(statId);
  });

  it('flags a repeated floor inside the story default ladder as a conflict', async () => {
    await strengthHandler.create(
      userId,
      storyId,
      create('StatStrength', newId(), { label: 'F', minValue: 0 }),
    );

    await expect(
      strengthHandler.create(
        userId,
        storyId,
        create('StatStrength', newId(), { label: 'D', minValue: 0 }),
      ),
    ).rejects.toThrow(SyncConflictError);
  });

  it('flags a repeated floor inside a stat ladder as a conflict', async () => {
    await strengthHandler.create(
      userId,
      storyId,
      create('StatStrength', newId(), { statId, label: 'C', minValue: 50 }),
    );

    await expect(
      strengthHandler.create(
        userId,
        storyId,
        create('StatStrength', newId(), { statId, label: 'B', minValue: 50 }),
      ),
    ).rejects.toThrow(/already has a tier starting at 50/);
  });

  it('flags an update that moves a tier onto an occupied floor', async () => {
    const movingId = newId();
    await strengthHandler.create(
      userId,
      storyId,
      create('StatStrength', newId(), { statId, label: 'F', minValue: 0 }),
    );
    await strengthHandler.create(
      userId,
      storyId,
      create('StatStrength', movingId, { statId, label: 'C', minValue: 50 }),
    );
    const current = await strengthHandler.findById(movingId);

    await expect(
      strengthHandler.update(
        userId,
        storyId,
        change('StatStrength', movingId, { version: current.version, minValue: 0 }),
        current,
      ),
    ).rejects.toThrow(SyncConflictError);
  });

  it('refuses a tier pointing at a stat from another story', async () => {
    await expect(
      strengthHandler.create(
        userId,
        storyId,
        create('StatStrength', newId(), { statId: newId(), label: 'F', minValue: 0 }),
      ),
    ).rejects.toThrow(SyncConflictError);
  });

  it('lets the same floor be reused after the tier is deleted', async () => {
    const firstId = newId();
    await strengthHandler.create(
      userId,
      storyId,
      create('StatStrength', firstId, { statId, label: 'F', minValue: 0 }),
    );
    await db
      .update(statStrengths)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(statStrengths.id, firstId));

    await strengthHandler.create(
      userId,
      storyId,
      create('StatStrength', newId(), { statId, label: 'E', minValue: 0 }),
    );

    const alive = await db.select().from(statStrengths).where(eq(statStrengths.isDeleted, false));
    expect(alive).toHaveLength(1);
  });
});

describe('StatRelation', () => {
  it('stores the base value and a mode override side by side', async () => {
    const modeId = newId();
    await modeHandler.create(
      userId,
      storyId,
      create('Mode', modeId, { characterId, name: 'Desperta' }),
    );

    await valueHandler.create(
      userId,
      storyId,
      create('StatRelation', newId(), { characterId, statId, value: 120 }),
    );
    await valueHandler.create(
      userId,
      storyId,
      create('StatRelation', newId(), { characterId, modeId, statId, value: 480 }),
    );

    const rows = await db.select().from(statRelations).where(eq(statRelations.storyId, storyId));
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.modeId === null)?.value).toBe(120);
    expect(rows.find((row) => row.modeId === modeId)?.value).toBe(480);
  });

  it('flags a second value for the same character, mode and stat', async () => {
    await valueHandler.create(
      userId,
      storyId,
      create('StatRelation', newId(), { characterId, statId, value: 120 }),
    );

    await expect(
      valueHandler.create(
        userId,
        storyId,
        create('StatRelation', newId(), { characterId, statId, value: 300 }),
      ),
    ).rejects.toThrow(SyncConflictError);
  });

  it('refuses a value whose mode belongs to another character', async () => {
    const modeId = newId();
    await modeHandler.create(
      userId,
      storyId,
      create('Mode', modeId, { characterId: otherCharacterId, name: 'Desperto' }),
    );

    await expect(
      valueHandler.create(
        userId,
        storyId,
        create('StatRelation', newId(), { characterId, modeId, statId, value: 10 }),
      ),
    ).rejects.toThrow(/does not belong to character/);
  });

  it('refuses a value for a stat that does not exist', async () => {
    await expect(
      valueHandler.create(
        userId,
        storyId,
        create('StatRelation', newId(), { characterId, statId: newId(), value: 10 }),
      ),
    ).rejects.toThrow(SyncConflictError);
  });
});

describe('Mode', () => {
  it('creates a mode for an existing character', async () => {
    const modeId = newId();

    await modeHandler.create(
      userId,
      storyId,
      create('Mode', modeId, { characterId, name: 'Desperta', modeChanges: 'Fica mais rápida.' }),
    );

    const rows = await db.select().from(modes).where(eq(modes.storyId, storyId));
    expect(rows[0]).toMatchObject({
      name: 'Desperta',
      characterId,
      modeChanges: 'Fica mais rápida.',
    });
  });

  it('refuses a mode for a character that does not exist', async () => {
    await expect(
      modeHandler.create(
        userId,
        storyId,
        create('Mode', newId(), { characterId: newId(), name: 'Fantasma' }),
      ),
    ).rejects.toThrow(SyncConflictError);
  });

  it('exists even for stories with the stat system turned off', async () => {
    await db.update(stories).set({ statSystem: false }).where(eq(stories.id, storyId));
    const modeId = newId();

    await modeHandler.create(
      userId,
      storyId,
      create('Mode', modeId, { characterId, name: 'Ferida' }),
    );

    expect(await modeHandler.findById(modeId)).toBeDefined();
  });
});

describe('stats belong to their story', () => {
  it('counts only living primaries when enforcing the limit', async () => {
    await db
      .update(stats)
      .set({ isDeleted: true, deletedAt: new Date() })
      .where(eq(stats.id, statId));
    for (let index = 0; index < MAX_PRIMARY_STATS; index += 1) {
      await statHandler.create(userId, storyId, create('Stat', newId(), { name: `Stat ${index}` }));
    }

    const alive = await db.select().from(stats).where(eq(stats.isDeleted, false));
    expect(alive).toHaveLength(MAX_PRIMARY_STATS);
  });
});
