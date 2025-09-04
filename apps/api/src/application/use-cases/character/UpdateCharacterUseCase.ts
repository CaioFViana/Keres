import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { CharacterResponse, CharacterUpdatePayload } from '@keres/shared'

export class UpdateCharacterUseCase {
  constructor(
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: CharacterUpdatePayload): Promise<CharacterResponse> {
    const existingCharacter = await this.characterRepository.findById(data.id)
    if (!existingCharacter) {
      throw new Error('Character not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingCharacter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const updatedCharacter = {
      ...existingCharacter,
      ...data,
      updatedAt: new Date(),
    }

    await this.characterRepository.update(updatedCharacter, existingCharacter.storyId)

    return {
      id: updatedCharacter.id,
      storyId: updatedCharacter.storyId,
      name: updatedCharacter.name,
      gender: updatedCharacter.gender,
      race: updatedCharacter.race,
      subrace: updatedCharacter.subrace,
      description: updatedCharacter.description,
      personality: updatedCharacter.personality,
      motivation: updatedCharacter.motivation,
      qualities: updatedCharacter.qualities,
      weaknesses: updatedCharacter.weaknesses,
      biography: updatedCharacter.biography,
      plannedTimeline: updatedCharacter.plannedTimeline,
      isFavorite: updatedCharacter.isFavorite,
      extraNotes: updatedCharacter.extraNotes,
      createdAt: updatedCharacter.createdAt,
      updatedAt: updatedCharacter.updatedAt,
    }
  }
}
