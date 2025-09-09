import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { BulkDeleteResponse } from '@keres/shared'

export class BulkDeleteCharacterRelationUseCase {
  constructor(
    private readonly characterRelationRepository: ICharacterRelationRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, ids: string[]): Promise<BulkDeleteResponse> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingCharacterRelation = await this.characterRelationRepository.findById(id)
        if (!existingCharacterRelation) {
          failedIds.push({ id, reason: 'Character relation not found' })
          continue
        }

        const character1 = await this.characterRepository.findById(
          existingCharacterRelation.charId1,
        )
        if (!character1) {
          failedIds.push({ id, reason: 'Character 1 not found for relation' })
          continue
        }
        const story = await this.storyRepository.findById(character1.storyId, userId)
        if (!story) {
          failedIds.push({
            id,
            reason: 'Story not found or not owned by user for character relation',
          })
          continue
        }

        await this.characterRelationRepository.delete(id)
        successfulIds.push(id)
      } catch (error: unknown) {
        failedIds.push({ id, reason: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
