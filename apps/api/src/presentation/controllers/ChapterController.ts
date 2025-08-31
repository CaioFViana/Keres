import type {
  CreateChapterUseCase,
  DeleteChapterUseCase,
  GetChaptersByStoryIdUseCase,
  GetChapterUseCase,
  UpdateChapterUseCase,
} from '@application/use-cases'
import type { z } from 'zod'

import {
  type ChapterCreateSchema,
  ChapterResponseSchema,
  type ChapterUpdateSchema,
} from '@keres/shared'

export class ChapterController {
  constructor(
    private readonly createChapterUseCase: CreateChapterUseCase,
    private readonly getChapterUseCase: GetChapterUseCase,
    private readonly updateChapterUseCase: UpdateChapterUseCase,
    private readonly deleteChapterUseCase: DeleteChapterUseCase,
    private readonly getChaptersByStoryIdUseCase: GetChaptersByStoryIdUseCase,
  ) {}

  async createChapter(data: z.infer<typeof ChapterCreateSchema>) {
    const chapter = await this.createChapterUseCase.execute(data)
    return ChapterResponseSchema.parse(chapter)
  }

  async getChapter(id: string) {
    const chapter = await this.getChapterUseCase.execute(id)
    if (!chapter) {
      throw new Error('Chapter not found')
    }
    return ChapterResponseSchema.parse(chapter)
  }

  async getChaptersByStoryId(storyId: string) {
    const chapters = await this.getChaptersByStoryIdUseCase.execute(storyId)
    return chapters.map((chapter) => ChapterResponseSchema.parse(chapter))
  }

  async updateChapter(id: string, data: z.infer<typeof ChapterUpdateSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedChapter = await this.updateChapterUseCase.execute({ id, ...updateData })
    if (!updatedChapter) {
      throw new Error('Chapter not found or does not belong to the specified story')
    }
    return ChapterResponseSchema.parse(updatedChapter)
  }

  async deleteChapter(id: string, storyId: string) {
    if (!storyId) {
      throw new Error('storyId is required for deletion')
    }
    const deleted = await this.deleteChapterUseCase.execute(id, storyId)
    if (!deleted) {
      throw new Error('Chapter not found or does not belong to the specified story')
    }
    return // No content to return for 204
  }
}
