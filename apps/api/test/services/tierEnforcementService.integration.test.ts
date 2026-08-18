import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { galleries, stories, tiers, users } from '../../src/db/schema';
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
