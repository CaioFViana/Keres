/**
 * @jest-environment node
 */
import { createGalleryRelationService } from '../../src/services/storymanagement/GalleryRelationService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * The gallery-relation reconciliation: `setOwnersForGallery` and `setGalleriesForOwner`.
 *
 * The link/unlink primitives already have their suite (`galleryLink.test.ts`). What was missing is
 * the set-reconciliation the pickers save through: given the desired final list, link what is new,
 * unlink what left, and touch nothing that stayed. An over-eager implementation would churn every
 * row on every save - each churned row is a sync operation the other device has to replay, and a
 * version bump that can collide with it.
 *
 * Two throws are deliberately not covered: the "the row vanished mid-write" guards on the
 * revive/unlink paths, which need the database to misbehave between two statements.
 */

let database: TestDatabase;

const ADA = { ownerId: 'ada', ownerType: 'Character' as const };
const HARBOR = { ownerId: 'harbor', ownerType: 'Location' as const };

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('GalleryRelationService unlink edge', () => {
  it('warns and stays quiet when unlinking a link that is not there', async () => {
    const service = createGalleryRelationService(database.db);

    await service.unlinkGalleryFromOwner(TEST_USER_ID, TEST_STORY_ID, 'media-1', ADA);

    expect(console.warn).toHaveBeenCalledWith(
      'Gallery relation between media-1 and Character ada not found or already removed.',
    );
    expect(await database.db.query.operationLogs.findMany()).toEqual([]);
  });
});

describe('GalleryRelationService setOwnersForGallery', () => {
  it('links the new owners, unlinks the removed ones and keeps the rest untouched', async () => {
    const service = createGalleryRelationService(database.db);
    await service.linkGalleryToOwner(TEST_USER_ID, TEST_STORY_ID, 'media-1', ADA);
    await service.linkGalleryToOwner(TEST_USER_ID, TEST_STORY_ID, 'media-1', HARBOR);
    const before = await database.db.query.operationLogs.findMany();

    await service.setOwnersForGallery(TEST_USER_ID, TEST_STORY_ID, 'media-1', [
      ADA,
      { ownerId: 'sage', ownerType: 'Character' },
    ]);

    const owners = await service.getOwnersForGallery(TEST_STORY_ID, 'media-1');
    expect(owners.map((row) => `${row.ownerType}:${row.ownerId}`).sort()).toEqual([
      'Character:ada',
      'Character:sage',
    ]);
    // One create (sage) plus one delete (harbor); ada's row was not rewritten.
    const after = await database.db.query.operationLogs.findMany();
    expect(after.length - before.length).toBe(2);
    expect(
      after
        .slice(before.length)
        .map((operation) => operation.operationType)
        .sort(),
    ).toEqual(['create', 'delete']);
  });

  it('writes nothing when the owners already match', async () => {
    const service = createGalleryRelationService(database.db);
    await service.linkGalleryToOwner(TEST_USER_ID, TEST_STORY_ID, 'media-1', ADA);
    const before = await database.db.query.operationLogs.findMany();

    await service.setOwnersForGallery(TEST_USER_ID, TEST_STORY_ID, 'media-1', [ADA]);

    expect(await database.db.query.operationLogs.findMany()).toHaveLength(before.length);
  });

  it('clears every owner when given an empty list', async () => {
    const service = createGalleryRelationService(database.db);
    await service.linkGalleryToOwner(TEST_USER_ID, TEST_STORY_ID, 'media-1', ADA);
    await service.linkGalleryToOwner(TEST_USER_ID, TEST_STORY_ID, 'media-1', HARBOR);

    await service.setOwnersForGallery(TEST_USER_ID, TEST_STORY_ID, 'media-1', []);

    expect(await service.getOwnersForGallery(TEST_STORY_ID, 'media-1')).toEqual([]);
  });
});

describe('GalleryRelationService setGalleriesForOwner', () => {
  it('reconciles an entity media list to exactly the given files', async () => {
    const service = createGalleryRelationService(database.db);
    await service.linkGalleryToOwner(TEST_USER_ID, TEST_STORY_ID, 'media-1', ADA);
    await service.linkGalleryToOwner(TEST_USER_ID, TEST_STORY_ID, 'media-2', ADA);
    const before = await database.db.query.operationLogs.findMany();

    await service.setGalleriesForOwner(TEST_USER_ID, TEST_STORY_ID, ADA, ['media-2', 'media-3']);

    const relations = await service.getRelationsForOwner(TEST_STORY_ID, ADA.ownerId, ADA.ownerType);
    expect(relations.map((row) => row.galleryId).sort()).toEqual(['media-2', 'media-3']);
    const after = await database.db.query.operationLogs.findMany();
    expect(after.length - before.length).toBe(2);
  });

  it('writes nothing when the media list already matches', async () => {
    const service = createGalleryRelationService(database.db);
    await service.linkGalleryToOwner(TEST_USER_ID, TEST_STORY_ID, 'media-1', ADA);
    const before = await database.db.query.operationLogs.findMany();

    await service.setGalleriesForOwner(TEST_USER_ID, TEST_STORY_ID, ADA, ['media-1']);

    expect(await database.db.query.operationLogs.findMany()).toHaveLength(before.length);
  });
});
