import type {
  CreateStoryUseCase,
  DeleteStoryUseCase,
  GetStoriesByUserIdUseCase,
  GetStoryUseCase,
  UpdateStoryUseCase,
} from '@application/use-cases'

import { StoryCreateSchema, StoryResponseSchema, StoryUpdateSchema } from '@keres/shared'
import z from 'zod'

export class StoryController {
  constructor(
    private readonly createStoryUseCase: CreateStoryUseCase,
    private readonly getStoryUseCase: GetStoryUseCase,
    private readonly updateStoryUseCase: UpdateStoryUseCase,
    private readonly deleteStoryUseCase: DeleteStoryUseCase,
    private readonly getStoriesByUserIdUseCase: GetStoriesByUserIdUseCase,
  ) {}

  async createStory(data: z.infer<typeof StoryCreateSchema>) {
    const story = await this.createStoryUseCase.execute(data)
    return StoryResponseSchema.parse(story)
  }

  async getStory(id: string) {
    const story = await this.getStoryUseCase.execute(id)
    if (!story) {
      throw new Error('Story not found')
    }
    return StoryResponseSchema.parse(story)
  }

  async getStoriesByUserId(userId: string) {
    const stories = await this.getStoriesByUserIdUseCase.execute(userId)
    return stories.map((story) => StoryResponseSchema.parse(story))
  }

  async updateStory(id: string, data: z.infer<typeof StoryUpdateSchema>) {
    const updatedStory = await this.updateStoryUseCase.execute({ id, ...data })
    if (!updatedStory) {
      throw new Error('Story not found')
    }
    return StoryResponseSchema.parse(updatedStory)
  }

  async deleteStory(id: string) {
    const deleted = await this.deleteStoryUseCase.execute(id)
    if (!deleted) {
      throw new Error('Story not found')
    }
    return
  }
}
