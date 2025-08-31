import type {
  CreateStoryUseCase,
  DeleteStoryUseCase,
  GetStoriesByUserIdUseCase,
  GetStoryUseCase,
  UpdateStoryUseCase,
} from '@application/use-cases'
import type { Context } from 'hono'

import { StoryResponseSchema } from '@keres/shared'

export class StoryController {
  constructor(
    private readonly createStoryUseCase: CreateStoryUseCase,
    private readonly getStoryUseCase: GetStoryUseCase,
    private readonly updateStoryUseCase: UpdateStoryUseCase,
    private readonly deleteStoryUseCase: DeleteStoryUseCase,
    private readonly getStoriesByUserIdUseCase: GetStoriesByUserIdUseCase,
  ) {}

  async createStory(c: Context) {
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const story = await this.createStoryUseCase.execute(data)
      return c.json(StoryResponseSchema.parse(story), 201)
    } catch (_error: unknown) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getStory(c: Context) {
    const storyId = c.req.param('id')

    try {
      const story = await this.getStoryUseCase.execute(storyId)
      if (!story) {
        return c.json({ error: 'Story not found' }, 404)
      }
      return c.json(StoryResponseSchema.parse(story), 200)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getStoriesByUserId(c: Context) {
    const userId = c.req.param('userId') // Assuming userId is passed as a param

    try {
      const stories = await this.getStoriesByUserIdUseCase.execute(userId)
      return c.json(
        stories.map((story) => StoryResponseSchema.parse(story)),
        200,
      )
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async updateStory(c: Context) {
    const storyId = c.req.param('id')
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const updatedStory = await this.updateStoryUseCase.execute({ id: storyId, ...data })
      return c.json(StoryResponseSchema.parse(updatedStory), 200)
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Story not found') {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async deleteStory(c: Context) {
    const storyId = c.req.param('id')

    try {
      await this.deleteStoryUseCase.execute(storyId)
      return c.json({}, 204)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }
}
