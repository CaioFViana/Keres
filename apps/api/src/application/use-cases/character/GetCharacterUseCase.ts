import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { CharacterResponse } from '@keres/shared'

export class GetCharacterUseCase {
  constructor(
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<CharacterResponse> {
    const character = await this.characterRepository.findById(id)
    if (!character) {
      throw new Error('Character not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(character.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    return {
      id: character.id,
      storyId: character.storyId,
      name: character.name,
      gender: character.gender,
      race: character.race,
      subrace: character.subrace,
      description: character.description,
      personality: character.personality,
      motivation: character.motivation,
      qualities: character.qualities,
      weaknesses: character.weaknesses,
      biography: character.biography,
      plannedTimeline: character.plannedTimeline,
      isFavorite: character.isFavorite,
      extraNotes: character.extraNotes,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    }
  }
}
