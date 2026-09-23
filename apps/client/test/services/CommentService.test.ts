/**
 * @jest-environment node
 */
import { eq } from 'drizzle-orm';
import * as schema from '../../src/db/schema';
import { createCommentService } from '../../src/services/storymanagement/CommentService';
import { seedLocalStory, TEST_STORY_ID, TEST_USER_ID } from '../helpers/storyTestData';
import { createTestDatabase, type TestDatabase } from '../helpers/testDb';

let database: TestDatabase;

beforeEach(async () => {
  database = await createTestDatabase();
  await seedLocalStory(database);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  database.close();
  jest.restoreAllMocks();
});

describe('CommentService', () => {
  it('creates, edits and lets the story owner moderate a comment', async () => {
    const service = createCommentService(database.db);
    const created = await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Character',
      'char-1',
      { fieldKey: 'biography' },
      {
        contentSnapshot: 'texto antigo',
        excerptText: 'antigo',
        commentText: 'Revisar',
        criticality: 2,
      },
    );

    const edited = await service.updateComment(TEST_USER_ID, created.id, {
      commentText: 'Revisar bem',
    });
    expect(edited).toMatchObject({ commentText: 'Revisar bem', version: 2 });
    expect(await service.deleteComment('moderator', created.id, true)).toBe(true);
    expect(await service.getCommentsForEntity(TEST_STORY_ID, 'Character', 'char-1')).toEqual([]);
  });

  it('does not let another collaborator edit or delete the author’s comment', async () => {
    const service = createCommentService(database.db);
    const created = await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Character',
      'char-1',
      { fieldId: 'field-1' },
      { contentSnapshot: null, excerptText: null, commentText: 'Meu comentário', criticality: 1 },
    );

    await expect(
      service.updateComment('other-user', created.id, { commentText: 'Tomar controle' }),
    ).rejects.toThrow('Only the comment author');
    await expect(service.deleteComment('other-user', created.id, false)).rejects.toThrow(
      'Only the comment author',
    );
  });

  it('refuses a reader comment on a linked story that forbids them', async () => {
    await database.db
      .update(schema.stories)
      .set({ serverId: 'server-1', myRole: 'reader', allowReaderComments: false })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    const service = createCommentService(database.db);

    await expect(
      service.createComment(
        TEST_USER_ID,
        TEST_STORY_ID,
        'Character',
        'char-1',
        { fieldKey: 'biography' },
        { contentSnapshot: null, excerptText: null, commentText: 'Nope', criticality: 1 },
      ),
    ).rejects.toThrow();

    // ...but allows it once the story opts in, and always for local stories.
    await database.db
      .update(schema.stories)
      .set({ allowReaderComments: true })
      .where(eq(schema.stories.id, TEST_STORY_ID));
    const created = await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Character',
      'char-1',
      { fieldKey: 'biography' },
      { contentSnapshot: null, excerptText: null, commentText: 'Yep', criticality: 1 },
    );
    expect(created.commentText).toBe('Yep');
  });

  it('pages the story comments newest-first with a total', async () => {
    const service = createCommentService(database.db);
    for (let index = 0; index < 3; index += 1) {
      const created = await service.createComment(
        TEST_USER_ID,
        TEST_STORY_ID,
        'Character',
        'char-1',
        { fieldKey: 'biography' },
        {
          contentSnapshot: null,
          excerptText: null,
          commentText: `Comment ${index}`,
          criticality: 1,
        },
      );
      // Three creates in the same millisecond would leave the newest-first order to chance.
      await database.db
        .update(schema.comments)
        .set({ createdAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`) })
        .where(eq(schema.comments.id, created.id));
    }

    const first = await service.getAllCommentsForStory(TEST_STORY_ID, { page: 0, pageSize: 2 });
    expect(first.total).toBe(3);
    expect(first.items.map((comment) => comment.commentText)).toEqual(['Comment 2', 'Comment 1']);
    const second = await service.getAllCommentsForStory(TEST_STORY_ID, { page: 1, pageSize: 2 });
    expect(second.total).toBe(3);
    expect(second.items.map((comment) => comment.commentText)).toEqual(['Comment 0']);
  });

  it('reports missing comments on update and delete instead of throwing silently', async () => {
    const service = createCommentService(database.db);

    await expect(
      service.updateComment(TEST_USER_ID, 'missing', { commentText: 'X' }),
    ).rejects.toThrow('Comment not found.');
    expect(await service.deleteComment(TEST_USER_ID, 'missing', false)).toBe(false);
  });

  it('migrates the author identity on login, and skips a no-op migration', async () => {
    const service = createCommentService(database.db);
    const created = await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Character',
      'char-1',
      { fieldKey: 'biography' },
      { contentSnapshot: null, excerptText: null, commentText: 'Mine', criticality: 1 },
    );

    await service.migrateAuthorIdentity(TEST_STORY_ID, TEST_USER_ID, TEST_USER_ID);
    await service.migrateAuthorIdentity(TEST_STORY_ID, TEST_USER_ID, 'server-user');

    const stored = await database.db.query.comments.findFirst({
      where: eq(schema.comments.id, created.id),
    });
    expect(stored?.authorUserId).toBe('server-user');
  });

  it('reads many entities in one query, live comments only', async () => {
    const service = createCommentService(database.db);
    const input = (commentText: string) => ({
      contentSnapshot: null,
      excerptText: null,
      commentText,
      criticality: 1,
    });
    await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Scene',
      's-1',
      { fieldKey: 'body' },
      input('One'),
    );
    await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Scene',
      's-2',
      { fieldKey: 'body' },
      input('Two'),
    );
    const removed = await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Scene',
      's-1',
      { fieldKey: 'body' },
      input('Gone'),
    );
    await service.deleteComment(TEST_USER_ID, removed.id, false);
    await service.createComment(
      TEST_USER_ID,
      TEST_STORY_ID,
      'Scene',
      's-9',
      { fieldKey: 'body' },
      input('Other'),
    );

    const rows = await service.getCommentsForEntities(TEST_STORY_ID, 'Scene', ['s-1', 's-2']);
    expect(rows.map((row) => row.commentText).sort()).toEqual(['One', 'Two']);
    expect(await service.getCommentsForEntities(TEST_STORY_ID, 'Scene', [])).toEqual([]);
  });
});
