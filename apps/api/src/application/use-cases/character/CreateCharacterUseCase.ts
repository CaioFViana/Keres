import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { CharacterCreatePayload, CharacterResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateCharacterUseCase {
  constructor(
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: CharacterCreatePayload): Promise<CharacterResponse> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(data.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const newCharacter: Character = {
      id: ulid(),
      storyId: data.storyId,
      name: data.name,
      gender: data.gender || null,
      race: data.race || null,
      subrace: data.subrace || null,
      description: data.description || null,
      personality: data.personality || null,
      motivation: data.motivation || null,
      qualities: data.qualities || null,
      weaknesses: data.weaknesses || null,
      biography: data.biography || null,
      plannedTimeline: data.plannedTimeline || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.characterRepository.save(newCharacter)

    return {
      id: newCharacter.id,
      storyId: newCharacter.storyId,
      name: newCharacter.name,
      gender: newCharacter.gender,
      race: newCharacter.race,
      subrace: newCharacter.subrace,
      description: newCharacter.description,
      personality: newCharacter.personality,
      motivation: newCharacter.motivation,
      qualities: newCharacter.qualities,
      weaknesses: newCharacter.weaknesses,
      biography: newCharacter.biography,
      plannedTimeline: newCharacter.plannedTimeline,
      isFavorite: newCharacter.isFavorite,
      extraNotes: newCharacter.extraNotes,
      createdAt: newCharacter.createdAt,
      updatedAt: newCharacter.updatedAt,
    }
  }
}
