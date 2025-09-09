import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { IWorldRuleRepository } from '@domain/repositories/IWorldRuleRepository'

export class BulkDeleteWorldRuleUseCase {
  constructor(
    private readonly worldRuleRepository: IWorldRuleRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(
    userId: string,
    ids: string[],
  ): Promise<{ successfulIds: string[]; failedIds: { id: string; reason: string }[] }> {
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
      } catch (error: any) {
        failedIds.push({ id, reason: error.message || 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
