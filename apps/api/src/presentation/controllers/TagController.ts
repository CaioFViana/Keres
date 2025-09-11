import type {
  AddTagToEntityUseCase,
  BulkDeleteTagUseCase,
  CreateTagUseCase,
  DeleteTagUseCase,
  GetTagsByStoryIdUseCase,
  GetTagUseCase,
  RemoveTagFromEntityUseCase,
  UpdateTagUseCase,
} from '@application/use-cases/tag'
import type { z } from 'zod'

import {
  type CreateTagSchema,
  ListQueryParams,
  type TagAssignmentPayload,
  type TagRemovalPayload,
  TagResponseSchema,
  type UpdateTagSchema,
} from '@keres/shared'

export class TagController {
  constructor(
    private readonly createTagUseCase: CreateTagUseCase,
    private readonly getTagUseCase: GetTagUseCase,
    private readonly getTagsByStoryIdUseCase: GetTagsByStoryIdUseCase,
    private readonly updateTagUseCase: UpdateTagUseCase,
    private readonly deleteTagUseCase: DeleteTagUseCase,
    private readonly bulkDeleteTagUseCase: BulkDeleteTagUseCase,
    private readonly addTagToEntityUseCase: AddTagToEntityUseCase,
    private readonly removeTagFromEntityUseCase: RemoveTagFromEntityUseCase,
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

  async getTagsByStoryId(userId: string, storyId: string, query: ListQueryParams) {
    const paginatedTags = await this.getTagsByStoryIdUseCase.execute(userId, storyId, query)
    const items = paginatedTags.items.map((tag) => TagResponseSchema.parse(tag))
    return {
      items,
      totalItems: paginatedTags.totalItems,
    }
  }

  async updateTag(userId: string, id: string, data: z.infer<typeof UpdateTagSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedTag = await this.updateTagUseCase.execute(userId, { id, ...updateData })
    if (!updatedTag) {
      throw new Error('Tag not found or does not belong to the specified story')
    }
    return TagResponseSchema.parse(updatedTag)
  }

  async deleteTag(userId: string, id: string) {
    const deleted = await this.deleteTagUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Tag not found or does not belong to the specified story')
    }
    return // No content to return for 204
  }

  async bulkDeleteTags(userId: string, ids: string[]) {
    const result = await this.bulkDeleteTagUseCase.execute(userId, ids)
    return result
  }

  async addTag(userId: string, data: TagAssignmentPayload): Promise<void> {
    await this.addTagToEntityUseCase.execute(userId, data)
  }

  async removeTag(userId: string, data: TagRemovalPayload): Promise<void> {
    await this.removeTagFromEntityUseCase.execute(userId, data)
  }
}
