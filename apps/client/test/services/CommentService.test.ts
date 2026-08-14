/**
 * @jest-environment node
 */
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
});
