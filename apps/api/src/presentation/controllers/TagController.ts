import type {
  CreateTagUseCase,
  DeleteTagUseCase,
  GetTagsByStoryIdUseCase,
  GetTagUseCase,
  UpdateTagUseCase,
} from '@application/use-cases';
import type z from 'zod';

import {
  type CreateTagSchema,
  TagResponseSchema,
  type UpdateTagSchema,
} from '@keres/shared';

export class TagController {
  constructor(
    private readonly createTagUseCase: CreateTagUseCase,
    private readonly getTagUseCase: GetTagUseCase,
    private readonly updateTagUseCase: UpdateTagUseCase,
    private readonly deleteTagUseCase: DeleteTagUseCase,
    private readonly getTagsByStoryIdUseCase: GetTagsByStoryIdUseCase,
  ) {}

  async createTag(data: z.infer<typeof CreateTagSchema>) {
    const tag = await this.createTagUseCase.execute(data);
    return TagResponseSchema.parse(tag);
  }

  async getTag(id: string) {
    const tag = await this.getTagUseCase.execute(id);
    if (!tag) {
      throw new Error('Tag not found');
    }
    return TagResponseSchema.parse(tag);
  }

  async getTagsByStoryId(storyId: string) {
    const tags = await this.getTagsByStoryIdUseCase.execute(storyId);
    return tags.map((tag) => TagResponseSchema.parse(tag));
  }

  async updateTag(id: string, data: z.infer<typeof UpdateTagSchema>) {
    const { id: dataId, ...updateData } = data;
    const updatedTag = await this.updateTagUseCase.execute({ id, ...updateData });
    if (!updatedTag) {
      throw new Error('Tag not found');
    }
    return TagResponseSchema.parse(updatedTag);
  }

  async deleteTag(id: string) {
    const deleted = await this.deleteTagUseCase.execute(id);
    if (!deleted) {
      throw new Error('Tag not found');
    }
    return;
  }
}