import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { CharacterResponse, CreateManyCharactersPayload } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateManyCharactersUseCase {
  constructor(
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, data: CreateManyCharactersPayload): Promise<CharacterResponse[]> {
    if (data.length === 0) {
      return []
    }

    const newCharacters: Character[] = []
    const characterResponses: CharacterResponse[] = []

    for (const characterPayload of data) {
      // Verify that the story exists and belongs to the user
      const story = await this.storyRepository.findById(characterPayload.storyId, userId)
      if (!story) {
        throw new Error(`Story with ID ${characterPayload.storyId} not found or not owned by user`)
      }

      const newCharacter: Character = {
        id: ulid(),
        storyId: characterPayload.storyId,
        name: characterPayload.name,
        gender: characterPayload.gender || null,
        race: characterPayload.race || null,
        subrace: characterPayload.subrace || null,
        description: characterPayload.description || null,
        personality: characterPayload.personality || null,
        motivation: characterPayload.motivation || null,
        qualities: characterPayload.qualities || null,
        weaknesses: characterPayload.weaknesses || null,
        biography: characterPayload.biography || null,
        plannedTimeline: characterPayload.plannedTimeline || null,
        isFavorite: characterPayload.isFavorite || false,
        extraNotes: characterPayload.extraNotes || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      newCharacters.push(newCharacter)
      characterResponses.push({
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
      })
    }

    await this.characterRepository.saveMany(newCharacters)

    return characterResponses
  }
}
