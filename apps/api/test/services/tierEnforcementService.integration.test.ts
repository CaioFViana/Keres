import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  characters,
  galleries,
  registrationSettings,
  stories,
  tiers,
  users,
} from '../../src/db/schema';
import {
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
