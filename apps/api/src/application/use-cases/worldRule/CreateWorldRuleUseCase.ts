import type { WorldRule } from '@domain/entities/WorldRule'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { CreateWorldRulePayload, WorldRuleResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateWorldRuleUseCase {
  constructor(
    private readonly worldRuleRepository: IWorldRuleRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: CreateWorldRulePayload): Promise<WorldRuleResponse> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(data.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const newWorldRule: WorldRule = {
      id: ulid(),
      storyId: data.storyId,
      title: data.title,
      description: data.description || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.worldRuleRepository.save(newWorldRule)

    return {
      id: newWorldRule.id,
      storyId: newWorldRule.storyId,
      title: newWorldRule.title,
      description: newWorldRule.description,
      isFavorite: newWorldRule.isFavorite,
      extraNotes: newWorldRule.extraNotes,
      createdAt: newWorldRule.createdAt,
      updatedAt: newWorldRule.updatedAt,
    }
  }
}
