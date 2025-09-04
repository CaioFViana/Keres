import type {
  CreateTagUseCase,
  DeleteTagUseCase,
  GetTagsByStoryIdUseCase,
  GetTagUseCase,
  UpdateTagUseCase,
} from '@application/use-cases'
import type z from 'zod'

import { type CreateTagSchema, TagResponseSchema, type UpdateTagSchema } from '@keres/shared'

export class TagController {
  constructor(
    private readonly createTagUseCase: CreateTagUseCase,
    private readonly getTagUseCase: GetTagUseCase,
    private readonly updateTagUseCase: UpdateTagUseCase,
    private readonly deleteTagUseCase: DeleteTagUseCase,
    private readonly getTagsByStoryIdUseCase: GetTagsByStoryIdUseCase,
  ) {}

  async createTag(userId: string, data: z.infer<typeof CreateTagSchema>) {
    const tag = await this.createTagUseCase.execute(userId, data)
    return TagResponseSchema.parse(tag)
  }

  async getTag(userId: string, id: string) {
    const tag = await this.getTagUseCase.execute(userId, id)
    if (!tag) {
      throw new Error('Tag not found')
    }
    return TagResponseSchema.parse(tag)
  }

  async getTagsByStoryId(userId: string, storyId: string) {
    const tags = await this.getTagsByStoryIdUseCase.execute(userId, storyId)
    return tags.map((tag) => TagResponseSchema.parse(tag))
  }

  async updateTag(userId: string, id: string, data: z.infer<typeof UpdateTagSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedTag = await this.updateTagUseCase.execute(userId, { id, ...updateData })
    if (!updatedTag) {
      throw new Error('Tag not found')
    }
    return TagResponseSchema.parse(updatedTag)
  }

  async deleteTag(userId: string, id: string) {
    const deleted = await this.deleteTagUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Tag not found')
    }
    return
  }
}
