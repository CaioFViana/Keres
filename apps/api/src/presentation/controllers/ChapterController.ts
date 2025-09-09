import type {
  BulkDeleteChapterUseCase,
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
  type ListQueryParams,
} from '@keres/shared'

export class ChapterController {
  constructor(
    private readonly createChapterUseCase: CreateChapterUseCase,
    private readonly getChapterUseCase: GetChapterUseCase,
    private readonly updateChapterUseCase: UpdateChapterUseCase,
    private readonly deleteChapterUseCase: DeleteChapterUseCase,
    private readonly bulkDeleteChapterUseCase: BulkDeleteChapterUseCase,
    private readonly getChaptersByStoryIdUseCase: GetChaptersByStoryIdUseCase,
  ) {}

  async createChapter(userId: string, data: z.infer<typeof ChapterCreateSchema>) {
    const chapter = await this.createChapterUseCase.execute(userId, data)
    return ChapterResponseSchema.parse(chapter)
  }

  async getChapter(userId: string, id: string, include: string[] = []) {
    const chapter = await this.getChapterUseCase.execute(userId, id, include)
    if (!chapter) {
      throw new Error('Chapter not found')
    }
    return ChapterResponseSchema.parse(chapter)
  }

  async getChaptersByStoryId(userId: string, storyId: string, query: ListQueryParams) {
    const chapters = await this.getChaptersByStoryIdUseCase.execute(userId, storyId, query)
    return chapters.map((chapter) => ChapterResponseSchema.parse(chapter))
  }

  async updateChapter(userId: string, id: string, data: z.infer<typeof ChapterUpdateSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedChapter = await this.updateChapterUseCase.execute(userId, { id, ...updateData })
    if (!updatedChapter) {
      throw new Error('Chapter not found or does not belong to the specified story')
    }
    return ChapterResponseSchema.parse(updatedChapter)
  }

  async deleteChapter(userId: string, id: string) {
    const deleted = await this.deleteChapterUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Chapter not found or does not belong to the specified story')
    }
    return // No content to return for 204
  }

  async bulkDeleteChapters(userId: string, ids: string[]) {
    const result = await this.bulkDeleteChapterUseCase.execute(userId, ids)
    return result
  }
}
