import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import
import type { CharacterRelationResponse, CharacterRelationUpdatePayload } from '@keres/shared'

export class UpdateCharacterRelationUseCase {
  constructor(
    private readonly characterRelationRepository: ICharacterRelationRepository,
    private readonly characterRepository: ICharacterRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(
    userId: string,
    data: CharacterRelationUpdatePayload,
  ): Promise<CharacterRelationResponse> {
    const existingCharacterRelation = await this.characterRelationRepository.findById(data.id)
    if (!existingCharacterRelation) {
      throw new Error('Character relation not found')
    }

    // Verify character1 ownership
    const character1 = await this.characterRepository.findById(existingCharacterRelation.charId1)
    if (!character1) {
      throw new Error('Character 1 not found for relation')
    }
    const story = await this.storyRepository.findById(character1.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user for character relation')
    }

    // Note: charId1 and charId2 are typically not updated for relations.
    // If they were, additional checks would be needed here.

    const updatedCharacterRelation = {
      ...existingCharacterRelation,
      ...data,
      updatedAt: new Date(),
    }

    await this.characterRelationRepository.update(
      updatedCharacterRelation,
      existingCharacterRelation.id,
      character1.storyId,
    )

    return {
      id: updatedCharacterRelation.id,
      charId1: updatedCharacterRelation.charId1,
      charId2: updatedCharacterRelation.charId2,
      relationType: updatedCharacterRelation.relationType,
      createdAt: updatedCharacterRelation.createdAt,
      updatedAt: updatedCharacterRelation.updatedAt,
    }
  }
}
