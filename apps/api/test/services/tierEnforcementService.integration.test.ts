import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  characters,
  galleries,
  mediaBlobs,
  registrationSettings,
  stories,
  tagRelations,
  tags,
  tiers,
  users,
} from '../../src/db/schema';
import {
  BlobNotReferencedError,
  TierLimitExceededError,
  tierEnforcementService,
} from '../../src/services/TierEnforcementService';
import { newId } from '../helpers/app';
import { truncateAll } from '../helpers/database';

let userId: string;
let storyId: string;

async function seedGallery(sizeBytes: number) {
  const now = new Date();
  await db.insert(galleries).values({
    id: newId(),
    storyId,
    mediaType: 'image',
    mimeType: 'image/png',
    fileName: `${newId()}.png`,
    hash: newId().toLowerCase().padEnd(32, '0').slice(0, 32),
    sizeBytes,
    title: null,
    isFavorite: false,
    extraNotes: null,
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
    deletedAt: null,
  } as never);
}

beforeEach(async () => {
  await truncateAll();
  userId = newId();
  storyId = newId();
  const now = new Date();
  await db
    .insert(users)
    .values({ id: userId, username: 'ana', tag: 'ana', password: 'x' } as never);
  await db.insert(stories).values({
    id: storyId,
    userId,
    title: 'A Queda',
    type: 'linear',
    createdAt: now,
    updatedAt: now,
    version: 1,
    isDeleted: false,
  } as never);
});

/**
 * `coalesce(sum(size_bytes), 0)::int` raised a raw "integer out of range" Postgres error
 * (not a controlled `TierLimitExceededError`) the moment a story's real gallery total crossed
 * ~2.1GB - reachable even though the *limit* column itself is capped there too, since an
 * unlimited-until-now tier or a story that predates a tightened limit can already hold more.
 * Fixed by summing as `::bigint` and parsing the string Postgres returns for it. These prove
 * the sum itself no longer crashes past that boundary, whichever way the comparison resolves.
 */
describe('TierEnforcementService storage sum overflow', () => {
  it('rejects with a controlled TierLimitExceededError instead of a raw DB range error once usage crosses 2^31 bytes', async () => {
    const tierId = newId();
    await db.insert(tiers).values({
      id: tierId,
      name: `Tier ${tierId}`,
      isDefault: false,
      maxStories: null,
      maxEntitiesPerStory: null,
      maxEntitiesTotal: null,
      maxStorageBytesPerStory: 2_147_483_647, // int4 max - the highest a limit can even be set to
      maxStorageBytesTotal: null,
    } as never);
    await db.update(users).set({ tierId }).where(eq(users.id, userId));

    // Three rows summing past both int4 max and the tier's own (int4-capped) limit.
    await seedGallery(800_000_000);
    await seedGallery(800_000_000);
    await seedGallery(800_000_000);

    await expect(
      tierEnforcementService.assertCanUploadMedia(userId, storyId, 1),
    ).rejects.toBeInstanceOf(TierLimitExceededError);
  });
});

async function seedTier(overrides: Record<string, number | null> = {}) {
  const tierId = newId();
  await db.insert(tiers).values({
    id: tierId,
    name: `Tier ${tierId}`,
    isDefault: false,
    maxStories: null,
    maxEntitiesPerStory: null,
    maxEntitiesTotal: null,
    maxStorageBytesPerStory: null,
    maxStorageBytesTotal: null,
    ...overrides,
  } as never);
  return tierId;
}

async function assignTier(tierId: string) {
  await db.update(users).set({ tierId }).where(eq(users.id, userId));
}

describe('TierEnforcementService effective tier', () => {
  it('falls back to the signup default tier when the user has none', async () => {
    const tierId = await seedTier();
    await db
      .insert(registrationSettings)
      .values({ id: 'singleton', defaultTierId: tierId } as never);

    await expect(tierEnforcementService.getEffectiveTier(userId)).resolves.toMatchObject({
      id: tierId,
    });
  });

  it('treats a user with no tier and no default as unlimited', async () => {
    await expect(tierEnforcementService.getEffectiveTier(userId)).resolves.toBeNull();
  });

  it('prefers the user tier over the signup default', async () => {
    const userTierId = await seedTier();
    const defaultTierId = await seedTier();
    await assignTier(userTierId);
    await db.insert(registrationSettings).values({ id: 'singleton', defaultTierId } as never);

    await expect(tierEnforcementService.getEffectiveTier(userId)).resolves.toMatchObject({
      id: userTierId,
    });
  });
});

describe('TierEnforcementService story limits', () => {
  it('lets an unlimited user create stories', async () => {
    await expect(tierEnforcementService.assertCanCreateStory(userId)).resolves.toBeUndefined();
  });

  it('lets a user pass when only other ceilings are set', async () => {
    await assignTier(await seedTier({ maxEntitiesPerStory: 0 }));

    await expect(tierEnforcementService.assertCanCreateStory(userId)).resolves.toBeUndefined();
  });

  it('refuses a story at the plan ceiling', async () => {
    await assignTier(await seedTier({ maxStories: 1 }));

    await expect(tierEnforcementService.assertCanCreateStory(userId)).rejects.toThrow(
      /Story limit reached for your plan \(1\)/,
    );
  });

  it('allows a story below the ceiling', async () => {
    await assignTier(await seedTier({ maxStories: 2 }));

    await expect(tierEnforcementService.assertCanCreateStory(userId)).resolves.toBeUndefined();
  });

  it('does not count deleted stories against the ceiling', async () => {
    await assignTier(await seedTier({ maxStories: 1 }));
    await db.update(stories).set({ isDeleted: true }).where(eq(stories.id, storyId));

    await expect(tierEnforcementService.assertCanCreateStory(userId)).resolves.toBeUndefined();
  });
});

describe('TierEnforcementService entity limits', () => {
  it('lets an unlimited user create entities', async () => {
    await expect(
      tierEnforcementService.assertCanCreateEntity(userId, storyId),
    ).resolves.toBeUndefined();
  });

  it('lets a user pass when neither entity ceiling is set', async () => {
    await assignTier(await seedTier({ maxStories: 1 }));

    await expect(
      tierEnforcementService.assertCanCreateEntity(userId, storyId),
    ).resolves.toBeUndefined();
  });

  it('refuses an entity when the story is at its ceiling', async () => {
    await assignTier(await seedTier({ maxEntitiesPerStory: 0 }));

    await expect(tierEnforcementService.assertCanCreateEntity(userId, storyId)).rejects.toThrow(
      /Entity limit for this story reached for your plan \(0\)/,
    );
  });

  it('allows an entity below the per-story ceiling', async () => {
    await assignTier(await seedTier({ maxEntitiesPerStory: 100 }));

    await expect(
      tierEnforcementService.assertCanCreateEntity(userId, storyId),
    ).resolves.toBeUndefined();
  });

  it('refuses an entity when the account total is at its ceiling', async () => {
    await assignTier(await seedTier({ maxEntitiesTotal: 0 }));

    await expect(tierEnforcementService.assertCanCreateEntity(userId, storyId)).rejects.toThrow(
      /Total entity limit reached for your plan \(0\)/,
    );
  });

  it('allows an entity below the total ceiling', async () => {
    await assignTier(await seedTier({ maxEntitiesTotal: 100 }));

    await expect(
      tierEnforcementService.assertCanCreateEntity(userId, storyId),
    ).resolves.toBeUndefined();
  });

  it('counts real rows against the per-story ceiling', async () => {
    await assignTier(await seedTier({ maxEntitiesPerStory: 1 }));
    await db.insert(characters).values({ id: newId(), storyId, name: 'Nyx' } as never);

    await expect(tierEnforcementService.assertCanCreateEntity(userId, storyId)).rejects.toThrow(
      /Entity limit for this story reached for your plan \(1\)/,
    );
  });
});

describe('TierEnforcementService what counts as an entity', () => {
  async function seedTagWithRelations(relations: number) {
    const tagId = newId();
    await db.insert(tags).values({ id: tagId, storyId, name: 'Magic' } as never);
    for (let i = 0; i < relations; i++) {
      await db.insert(tagRelations).values({
        id: newId(),
        storyId,
        tagId,
        relationId: newId(),
        relationType: 'Character',
      } as never);
    }
  }

  it('does not count the rows that only link entities, however many there are', async () => {
    await assignTier(await seedTier({ maxEntitiesPerStory: 2 }));
    // One tag is one entity; its five assignments are not.
    await seedTagWithRelations(5);

    await expect(
      tierEnforcementService.assertCanCreateEntity(userId, storyId),
    ).resolves.toBeUndefined();
  });

  it('still counts what the writer creates', async () => {
    await assignTier(await seedTier({ maxEntitiesPerStory: 1 }));
    await seedTagWithRelations(5);

    await expect(tierEnforcementService.assertCanCreateEntity(userId, storyId)).rejects.toThrow(
      /Entity limit for this story reached for your plan \(1\)/,
    );
  });

  it('leaves the links out of what the owner has used of the total ceiling', async () => {
    await assignTier(await seedTier({ maxEntitiesTotal: 900 }));
    await seedTagWithRelations(5);

    const plan = await tierEnforcementService.getStoryPlan(storyId);

    expect(plan.entitiesUsedTotal).toBe(1);
  });
});

describe('TierEnforcementService storage limits', () => {
  it('lets an upload through when storage is uncapped', async () => {
    await assignTier(await seedTier({ maxStories: 1 }));

    await expect(
      tierEnforcementService.assertCanUploadMedia(userId, storyId, 1),
    ).resolves.toBeUndefined();
  });

  it('allows an upload that fits the per-story budget', async () => {
    await assignTier(await seedTier({ maxStorageBytesPerStory: 1000 }));
    await seedGallery(100);

    await expect(
      tierEnforcementService.assertCanUploadMedia(userId, storyId, 1),
    ).resolves.toBeUndefined();
  });

  it('checks the total budget when the story has none', async () => {
    await assignTier(await seedTier({ maxStorageBytesTotal: 1000 }));

    await expect(
      tierEnforcementService.assertCanUploadMedia(userId, storyId, 1),
    ).resolves.toBeUndefined();
  });

  it('refuses an upload over the total budget', async () => {
    await assignTier(await seedTier({ maxStorageBytesTotal: 50 }));
    await seedGallery(100);

    await expect(tierEnforcementService.assertCanUploadMedia(userId, storyId, 1)).rejects.toThrow(
      /Total storage limit reached for your plan \(50 bytes\)/,
    );
  });

  it('allows an upload that fits the total budget', async () => {
    await assignTier(await seedTier({ maxStorageBytesTotal: 1000 }));
    await seedGallery(100);

    await expect(
      tierEnforcementService.assertCanUploadMedia(userId, storyId, 1),
    ).resolves.toBeUndefined();
  });
});

describe('TierEnforcementService honest storage ledger', () => {
  const HASH = 'a'.repeat(32);

  async function seedRow(hash: string, sizeBytes: number) {
    const now = new Date();
    await db.insert(galleries).values({
      id: newId(),
      storyId,
      mediaType: 'image',
      mimeType: 'image/png',
      fileName: `${newId()}.png`,
      hash,
      sizeBytes,
      title: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
      isDeleted: false,
      deletedAt: null,
    } as never);
  }

  async function seedBlob(hash: string, sizeBytes: number) {
    await db
      .insert(mediaBlobs)
      .values({ hash, mimeType: 'image/png', sizeBytes, storagePath: `x/${hash}` } as never);
  }

  it('counts a stored blob at its true size, whatever its row declared', async () => {
    await assignTier(await seedTier({ maxStorageBytesPerStory: 100 }));
    await seedRow(HASH, 0);
    await seedBlob(HASH, 90);

    await expect(tierEnforcementService.assertCanUploadMedia(userId, storyId, 20)).rejects.toThrow(
      TierLimitExceededError,
    );
  });

  it('refuses to store bytes no live media file of the story refers to', async () => {
    await expect(
      tierEnforcementService.assertCanStoreBlob(userId, storyId, HASH, 10),
    ).rejects.toBeInstanceOf(BlobNotReferencedError);
  });

  it('charges an upload at its real size in place of the declared one', async () => {
    await assignTier(await seedTier({ maxStorageBytesPerStory: 100 }));
    await seedRow(HASH, 0);

    await expect(
      tierEnforcementService.assertCanStoreBlob(userId, storyId, HASH, 101),
    ).rejects.toBeInstanceOf(TierLimitExceededError);
    await expect(
      tierEnforcementService.assertCanStoreBlob(userId, storyId, HASH, 100),
    ).resolves.toBeUndefined();
  });

  it("holds a collaborator's writes to the story owner's plan", async () => {
    const writerId = newId();
    await db
      .insert(users)
      .values({ id: writerId, username: 'bia', tag: 'bia', password: 'x' } as never);
    await assignTier(await seedTier({ maxEntitiesPerStory: 0 }));
    // The writer has no tier at all (unlimited) - it must not matter in the owner's story.
    await expect(
      tierEnforcementService.assertCanCreateEntity(writerId, storyId),
    ).rejects.toBeInstanceOf(TierLimitExceededError);
  });
});

describe('TierEnforcementService getStoryPlan', () => {
  it('reports no ceilings for an owner with no plan', async () => {
    await expect(tierEnforcementService.getStoryPlan(storyId)).resolves.toEqual({
      tierName: null,
      maxEntitiesPerStory: null,
      maxEntitiesTotal: null,
      entitiesUsedTotal: 0,
    });
  });

  it("reports the owner's ceilings and what the owner uses of the total one", async () => {
    const tierId = await seedTier({ maxEntitiesPerStory: 500, maxEntitiesTotal: 900 });
    await assignTier(tierId);
    const now = new Date();
    await db.insert(characters).values(
      ['a', 'b', 'c'].map((name) => ({
        id: newId(),
        storyId,
        name,
        createdAt: now,
        updatedAt: now,
        version: 1,
        isDeleted: false,
      })) as never,
    );

    await expect(tierEnforcementService.getStoryPlan(storyId)).resolves.toEqual({
      tierName: `Tier ${tierId}`,
      maxEntitiesPerStory: 500,
      maxEntitiesTotal: 900,
      entitiesUsedTotal: 3,
    });
  });

  it('skips the total count when there is no total ceiling to compare it with', async () => {
    await assignTier(await seedTier({ maxEntitiesPerStory: 500 }));

    const plan = await tierEnforcementService.getStoryPlan(storyId);

    expect(plan).toMatchObject({ maxEntitiesPerStory: 500, maxEntitiesTotal: null });
    expect(plan.entitiesUsedTotal).toBe(0);
  });
});

describe('a free plan with every ceiling at 0', () => {
  const everythingAtZero = {
    maxStories: 0,
    maxEntitiesPerStory: 0,
    maxEntitiesTotal: 0,
    maxStorageBytesPerStory: 0,
    maxStorageBytesTotal: 0,
    maxPublicationsPerDay: 0,
  };

  beforeEach(async () => {
    await assignTier(await seedTier(everythingAtZero));
  });

  it('allows nothing: no story, no entity, no media, no publication', async () => {
    await expect(tierEnforcementService.assertCanCreateStory(userId)).rejects.toThrow(
      /Story limit reached for your plan \(0\)/,
    );
    await expect(tierEnforcementService.assertCanCreateEntity(userId, storyId)).rejects.toThrow(
      /limit/i,
    );
    await expect(tierEnforcementService.assertCanUploadMedia(userId, storyId, 1)).rejects.toThrow(
      TierLimitExceededError,
    );
    await expect(tierEnforcementService.assertCanPublish(userId)).rejects.toThrow(
      /Publication limit/,
    );
  });

  it('is a plan, not the absence of one: it is what a person with no plan has when it is the default', async () => {
    const zero = (await db.query.users.findFirst({ where: eq(users.id, userId) }))!.tierId!;
    await db.update(users).set({ tierId: null }).where(eq(users.id, userId));
    await db.insert(registrationSettings).values({ id: 'singleton', defaultTierId: zero } as never);

    await expect(tierEnforcementService.assertCanCreateStory(userId)).rejects.toThrow(
      TierLimitExceededError,
    );
  });

  it('is told apart from a ceiling left blank, which is unlimited', async () => {
    await assignTier(await seedTier({ ...everythingAtZero, maxStories: null }));

    await expect(tierEnforcementService.assertCanCreateStory(userId)).resolves.toBeUndefined();
    await expect(tierEnforcementService.assertCanCreateEntity(userId, storyId)).rejects.toThrow(
      /limit/i,
    );
  });
});
