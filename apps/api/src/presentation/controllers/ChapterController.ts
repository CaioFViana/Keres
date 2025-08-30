import { Context } from 'hono';
import {
  CreateChapterUseCase,
  GetChapterUseCase,
  UpdateChapterUseCase,
  DeleteChapterUseCase,
  GetChaptersByStoryIdUseCase,
} from '@application/use-cases';
import { ChapterCreateSchema, ChapterUpdateSchema, ChapterResponseSchema } from '@keres/shared';

export class ChapterController {
  constructor(
    private readonly createChapterUseCase: CreateChapterUseCase,
    private readonly getChapterUseCase: GetChapterUseCase,
    private readonly updateChapterUseCase: UpdateChapterUseCase,
    private readonly deleteChapterUseCase: DeleteChapterUseCase,
    private readonly getChaptersByStoryIdUseCase: GetChaptersByStoryIdUseCase
  ) {}

  async createChapter(c: Context) {
    const data = c.req.valid('json'); // Validated by zValidator middleware

    try {
      const chapter = await this.createChapterUseCase.execute(data);
      return c.json(ChapterResponseSchema.parse(chapter), 201);
    } catch (error: any) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getChapter(c: Context) {
    const chapterId = c.req.param('id');

    try {
      const chapter = await this.getChapterUseCase.execute(chapterId);
      if (!chapter) {
        return c.json({ error: 'Chapter not found' }, 404);
      }
      return c.json(ChapterResponseSchema.parse(chapter), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getChaptersByStoryId(c: Context) {
    const storyId = c.req.param('storyId'); // Assuming storyId is passed as a param

    try {
      const chapters = await this.getChaptersByStoryIdUseCase.execute(storyId);
      return c.json(chapters.map(chapter => ChapterResponseSchema.parse(chapter)), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateChapter(c: Context) {
    const chapterId = c.req.param('id');
    const data = c.req.valid('json'); // Validated by zValidator middleware

    try {
      const updatedChapter = await this.updateChapterUseCase.execute({ id: chapterId, ...data });
      if (!updatedChapter) {
        return c.json({ error: 'Chapter not found or does not belong to the specified story' }, 404);
      }
      return c.json(ChapterResponseSchema.parse(updatedChapter), 200);
    } catch (error: any) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteChapter(c: Context) {
    const chapterId = c.req.param('id');
    const storyId = c.req.query('storyId'); // Assuming storyId is passed as a query param for delete

    if (!storyId) {
      return c.json({ error: 'storyId is required for deletion' }, 400);
    }

    try {
      const deleted = await this.deleteChapterUseCase.execute(chapterId, storyId);
      if (!deleted) {
        return c.json({ error: 'Chapter not found or does not belong to the specified story' }, 404);
      }
      return c.json({}, 204);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}