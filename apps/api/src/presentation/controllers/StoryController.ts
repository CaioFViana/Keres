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
  type PaginatedResponse,
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

  async getStoriesByUserId(
    userId: string,
    query: ListQueryParams,
    include: string[] = [],
  ): Promise<PaginatedResponse<z.infer<typeof StoryResponseSchema>>> {
    const paginatedStories = await this.getStoriesByUserIdUseCase.execute(userId, query, include)
    const items = paginatedStories.items.map((story) => StoryResponseSchema.parse(story))

    return {
      items,
      totalItems: paginatedStories.totalItems,
    }
  }

  async updateStory(
    userId: string,
    id: string,
    data: Omit<z.infer<typeof StoryUpdateSchema>, 'id'>,
  ) {
    const updatedStory = await this.updateStoryUseCase.execute(userId, id, data)
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
