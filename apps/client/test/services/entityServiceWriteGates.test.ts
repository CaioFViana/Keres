/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createAttributeValueService } from '../../src/services/storymanagement/AttributeValueService';
import { createCharacterRelationService } from '../../src/services/storymanagement/CharacterRelationService';
import { createCharacterSceneService } from '../../src/services/storymanagement/CharacterSceneService';
import { createCommentService } from '../../src/services/storymanagement/CommentService';
import { createFavoriteService } from '../../src/services/storymanagement/FavoriteService';
import { createLocationRelationService } from '../../src/services/storymanagement/LocationRelationService';
import { createNoteRelationService } from '../../src/services/storymanagement/NoteRelationService';
import { createSeeAlsoRelationService } from '../../src/services/storymanagement/SeeAlsoRelationService';
import { createTagService } from '../../src/services/storymanagement/TagService';
import { createTagRelationService } from '../../src/services/storymanagement/TagRelationService';
import { StoryReadOnlyError } from '../../src/utils/syncUtils';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

/**
 * Every entity service must refuse mutations up front when the story is linked and the
 * local role cannot write - mirroring the server (`SyncPushService` + `allowsReaderWrite`).
 * Without the guard, a reader's edit lands in the local tables, queues an operation the
 * server rejects on every cycle, and only converges through a confusing conflict.
 *
 * Readers keep exactly the server's two exceptions: favourites (always) and comments
 * (only with `allowReaderComments`).
 */

let database: TestDatabase;

const linkStory = (fields: Partial<typeof schema.stories.$inferInsert>) =>
  database.db.update(schema.stories).set(fields).where(eq(schema.stories.id, TEST_STORY_ID));

beforeEach(async () => {
  database = await createTestDatabase();
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  await seedLocalStory(database);
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('reader write guards', () => {
  it('refuses tag mutations', async () => {
    const service = createTagService(database.db);
    const tag = await service.createTag(TEST_USER_ID, { storyId: TEST_STORY_ID, name: 't' } as any);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(
      service.createTag(TEST_USER_ID, { storyId: TEST_STORY_ID, name: 'x' } as any),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);
    await expect(service.updateTag(TEST_USER_ID, tag.id, { name: 'y' })).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
    await expect(service.deleteTag(TEST_USER_ID, tag.id)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
  });

  it('refuses tag-relation mutations', async () => {
    const tags = createTagService(database.db);
    const service = createTagRelationService(database.db);
    const tag = await tags.createTag(TEST_USER_ID, { storyId: TEST_STORY_ID, name: 't' } as any);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(
      service.addTagToEntity(TEST_USER_ID, TEST_STORY_ID, 'char-1', 'Character', tag.id),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);

    await linkStory({ serverId: null, myRole: null });
    await service.addTagToEntity(TEST_USER_ID, TEST_STORY_ID, 'char-1', 'Character', tag.id);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });
    await expect(
      service.removeTagFromEntity(TEST_USER_ID, TEST_STORY_ID, 'char-1', 'Character', tag.id),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);
  });

  it('refuses character-relation mutations', async () => {
    const service = createCharacterRelationService(database.db);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(
      service.saveCharacterRelation(TEST_USER_ID, {
        storyId: TEST_STORY_ID,
        character1Id: 'a',
        character2Id: 'b',
        relationType: 'allies',
      } as any),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);

    await linkStory({ serverId: null, myRole: null });
    const saved = await service.saveCharacterRelation(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      character1Id: 'a',
      character2Id: 'b',
      relationType: 'allies',
    } as any);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });
    await expect(service.deleteCharacterRelation(TEST_USER_ID, saved.id)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
  });

  it('refuses character-scene mutations', async () => {
    const service = createCharacterSceneService(database.db);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(
      service.saveCharacterScene(TEST_USER_ID, {
        storyId: TEST_STORY_ID,
        characterId: 'a',
        sceneId: 's',
      } as any),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);

    await linkStory({ serverId: null, myRole: null });
    const saved = await service.saveCharacterScene(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      characterId: 'a',
      sceneId: 's',
    } as any);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });
    await expect(service.deleteCharacterScene(TEST_USER_ID, saved.id)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
  });

  it('refuses location-relation mutations', async () => {
    const service = createLocationRelationService(database.db);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(
      service.setParent(TEST_USER_ID, TEST_STORY_ID, 'child', 'parent'),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);
    await expect(
      service.addConnection(TEST_USER_ID, TEST_STORY_ID, 'a', 'b'),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);

    await linkStory({ serverId: null, myRole: null });
    const edge = await service.addConnection(TEST_USER_ID, TEST_STORY_ID, 'a', 'b');
    await linkStory({ serverId: 'server-1', myRole: 'reader' });
    await expect(service.removeRelation(TEST_USER_ID, edge.id)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
  });

  it('refuses note-relation mutations', async () => {
    const service = createNoteRelationService(database.db);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(
      service.saveNoteRelation(TEST_USER_ID, {
        storyId: TEST_STORY_ID,
        noteId: 'n',
        relationId: 'c',
        relationType: 'Character',
      } as any),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);

    await linkStory({ serverId: null, myRole: null });
    const saved = await service.saveNoteRelation(TEST_USER_ID, {
      storyId: TEST_STORY_ID,
      noteId: 'n',
      relationId: 'c',
      relationType: 'Character',
    } as any);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });
    await expect(service.deleteNoteRelation(TEST_USER_ID, saved.id)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
  });

  it('refuses see-also mutations', async () => {
    const service = createSeeAlsoRelationService(database.db);
    const a = { entityType: 'Character', entityId: 'a' } as any;
    const b = { entityType: 'Character', entityId: 'b' } as any;
    await linkStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(service.addSeeAlsoLink(TEST_USER_ID, TEST_STORY_ID, a, b)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );

    await linkStory({ serverId: null, myRole: null });
    const link = await service.addSeeAlsoLink(TEST_USER_ID, TEST_STORY_ID, a, b);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });
    await expect(service.removeSeeAlsoLink(TEST_USER_ID, link.id)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
  });

  it('refuses comment edits and deletes when readers may not comment', async () => {
    const service = createCommentService(database.db);
    const created = await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Character',
      'c',
      { fieldKey: 'k' } as any,
      { contentSnapshot: null, excerptText: null, commentText: 'hi', criticality: 0 },
    );
    await linkStory({ serverId: 'server-1', myRole: 'reader', allowReaderComments: false });

    await expect(
      service.updateComment(TEST_USER_ID, created.id, { commentText: 'edited' }),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);
    await expect(service.deleteComment(TEST_USER_ID, created.id, false)).rejects.toBeInstanceOf(
      StoryReadOnlyError,
    );
  });

  it('still lets readers comment when the story allows it', async () => {
    const service = createCommentService(database.db);
    await linkStory({ serverId: 'server-1', myRole: 'reader', allowReaderComments: true });

    const created = await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Character',
      'c',
      { fieldKey: 'k' } as any,
      { contentSnapshot: null, excerptText: null, commentText: 'hi', criticality: 0 },
    );
    await service.updateComment(TEST_USER_ID, created.id, { commentText: 'edited' });

    expect(
      (await database.db.query.comments.findFirst({ where: eq(schema.comments.id, created.id) }))
        ?.commentText,
    ).toBe('edited');
  });

  it('refuses attribute-value writes', async () => {
    const service = createAttributeValueService(database.db);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(
      service.saveValuesForEntity(TEST_USER_ID, TEST_STORY_ID, 'Character', 'c', {
        field1: 'v',
      }),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);
  });

  it('refuses favourites while the linked role is unresolved, but allows readers', async () => {
    const service = createFavoriteService(database.db);
    await linkStory({ serverId: 'server-1', myRole: null });

    await expect(
      service.setFavorite(TEST_STORY_ID, 'c', 'Character', TEST_USER_ID, true),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);

    await linkStory({ myRole: 'reader' });
    await service.setFavorite(TEST_STORY_ID, 'c', 'Character', TEST_USER_ID, true);

    expect(
      await database.db.query.favorites.findFirst({
        where: eq(schema.favorites.entityId, 'c'),
      }),
    ).toBeDefined();
  });
});

describe('reader write guards leave no trace', () => {
  it('writes nothing and queues no operation when refusing', async () => {
    const tags = createTagService(database.db);
    await linkStory({ serverId: 'server-1', myRole: 'reader' });

    await expect(
      tags.createTag(TEST_USER_ID, { storyId: TEST_STORY_ID, name: 'x' } as any),
    ).rejects.toBeInstanceOf(StoryReadOnlyError);

    expect(await database.db.query.tags.findMany()).toHaveLength(0);
    expect(await database.db.query.operationLogs.findMany()).toHaveLength(0);
  });
});
