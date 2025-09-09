import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'
import type { BulkDeleteResponse } from '@keres/shared'

export class BulkDeleteWorldRuleUseCase {
  constructor(
    private readonly worldRuleRepository: IWorldRuleRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, ids: string[]): Promise<BulkDeleteResponse> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingWorldRule = await this.worldRuleRepository.findById(id)
        if (!existingWorldRule) {
          failedIds.push({ id, reason: 'World Rule not found' })
          continue
        }

        const story = await this.storyRepository.findById(existingWorldRule.storyId, userId)
        if (!story) {
          failedIds.push({ id, reason: 'Story not found or not owned by user' })
          continue
        }

        await this.worldRuleRepository.delete(id, existingWorldRule.storyId)
        successfulIds.push(id)
      } catch (error: unknown) {
        failedIds.push({ id, reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
