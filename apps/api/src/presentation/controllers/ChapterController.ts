import { Context } from 'hono';
import {
  CreateChapterUseCase,
  GetChapterUseCase,
  GetChaptersByStoryIdUseCase,
  UpdateChapterUseCase,
  DeleteChapterUseCase,
} from '@application/use-cases';
import { createChapterSchema, updateChapterSchema, chapterProfileSchema } from '@presentation/schemas/ChapterSchemas';

export class ChapterController {
  constructor(
    private readonly createChapterUseCase: CreateChapterUseCase,
    private readonly getChapterUseCase: GetChapterUseCase,
    private readonly getChaptersByStoryIdUseCase: GetChaptersByStoryIdUseCase,
    private readonly updateChapterUseCase: UpdateChapterUseCase,
    private readonly deleteChapterUseCase: DeleteChapterUseCase
  ) {}

  async createChapter(c: Context) {
    const body = await c.req.json();
    const validation = createChapterSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const chapterProfile = await this.createChapterUseCase.execute(validation.data);
      return c.json(chapterProfileSchema.parse(chapterProfile), 201);
    } catch (error: any) {
      console.error('Error creating chapter:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getChapter(c: Context) {
    const chapterId = c.req.param('id');

    try {
      const chapterProfile = await this.getChapterUseCase.execute(chapterId);
      if (!chapterProfile) {
        return c.json({ error: 'Chapter not found' }, 404);
      }
      return c.json(chapterProfileSchema.parse(chapterProfile), 200);
    } catch (error: any) {
      console.error('Error getting chapter:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getChaptersByStoryId(c: Context) {
    const storyId = c.req.param('storyId');

    try {
      const chapters = await this.getChaptersByStoryIdUseCase.execute(storyId);
      return c.json(chapters.map(chapter => chapterProfileSchema.parse(chapter)), 200);
    } catch (error: any) {
      console.error('Error getting chapters by story ID:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async updateChapter(c: Context) {
    const chapterId = c.req.param('id');
    const body = await c.req.json();
    const validation = updateChapterSchema.safeParse({ id: chapterId, ...body });

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const updatedChapter = await this.updateChapterUseCase.execute(validation.data);
      if (!updatedChapter) {
        return c.json({ error: 'Chapter not found or unauthorized' }, 404);
      }
      return c.json(chapterProfileSchema.parse(updatedChapter), 200);
    } catch (error: any) {
      console.error('Error updating chapter:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async deleteChapter(c: Context) {
    const chapterId = c.req.param('id');
    // Assuming storyId comes from the request body or a header for authorization
    const storyId = c.req.header('x-story-id'); // For testing purposes

    if (!storyId) {
      return c.json({ error: 'Unauthorized: Missing story ID' }, 401);
    }

    try {
      const deleted = await this.deleteChapterUseCase.execute(chapterId, storyId);
      if (!deleted) {
        return c.json({ error: 'Chapter not found or unauthorized' }, 404);
      }
      return c.json({ message: 'Chapter deleted successfully' }, 200);
    } catch (error: any) {
      console.error('Error deleting chapter:', error);
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
