import type {
  CreateStoryUseCase,
  DeleteStoryUseCase,
  GetStoriesByUserIdUseCase,
  GetStoryUseCase,
  UpdateStoryUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type ListQueryParams,
  type StoryCreateSchema,
  StoryResponseSchema,
  type StoryUpdateSchema,
} from '@keres/shared'

export class StoryController {
  constructor(
    private readonly createStoryUseCase: CreateStoryUseCase,
    private readonly getStoryUseCase: GetStoryUseCase,
    private readonly updateStoryUseCase: UpdateStoryUseCase,
    private readonly deleteStoryUseCase: DeleteStoryUseCase,
    private readonly getStoriesByUserIdUseCase: GetStoriesByUserIdUseCase,
  ) {}

  async createStory(userId: string, data: z.infer<typeof StoryCreateSchema>) {
    const story = await this.createStoryUseCase.execute(userId, data)
    return StoryResponseSchema.parse(story)
  }

  async getStory(userId: string, id: string, include: string[] = []) {
    const story = await this.getStoryUseCase.execute(userId, id, include)
    if (!story) {
      throw new Error('Story not found')
    }
    return StoryResponseSchema.parse(story)
  }

  async getStoriesByUserId(userId: string, query: ListQueryParams, include: string[] = []) {
    const stories = await this.getStoriesByUserIdUseCase.execute(userId, query, include)
    return stories.map((story) => StoryResponseSchema.parse(story))
  }

  async updateStory(userId: string, id: string, data: z.infer<typeof StoryUpdateSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedStory = await this.updateStoryUseCase.execute(userId, { id, ...updateData })
    if (!updatedStory) {
      throw new Error('Story not found')
    }
    return StoryResponseSchema.parse(updatedStory)
  }

  async deleteStory(userId: string, id: string) {
    const deleted = await this.deleteStoryUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Story not found')
    }
    return
  }
}
