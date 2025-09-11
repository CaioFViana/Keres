import type { Character } from '@domain/entities/Character'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { CharacterResponse, UpdateManyCharactersPayload } from 'schemas'

export class UpdateManyCharactersUseCase {
  constructor(
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, data: UpdateManyCharactersPayload): Promise<CharacterResponse[]> {
    if (data.length === 0) {
      return []
    }

    const updatedCharacters: Character[] = []
    const characterResponses: CharacterResponse[] = []

    for (const characterPayload of data) {
      if (!characterPayload.id) {
        throw new Error('Character ID is required for batch update')
      }

      const existingCharacter = await this.characterRepository.findById(characterPayload.id)
      if (!existingCharacter) {
        throw new Error(`Character with ID ${characterPayload.id} not found`)
      }

      // Verify that the story exists and belongs to the user
      const story = await this.storyRepository.findById(existingCharacter.storyId, userId)
      if (!story) {
        throw new Error(`Story with ID ${existingCharacter.storyId} not found or not owned by user`)
      }

      const characterToUpdate: Character = {
        ...existingCharacter,
        ...characterPayload,
        updatedAt: new Date(),
      }
      updatedCharacters.push(characterToUpdate)
      characterResponses.push({
        id: characterToUpdate.id,
        storyId: characterToUpdate.storyId,
        name: characterToUpdate.name,
        gender: characterToUpdate.gender,
        race: characterToUpdate.race,
        subrace: characterToUpdate.subrace,
        description: characterToUpdate.description,
        personality: characterToUpdate.personality,
        motivation: characterToUpdate.motivation,
        qualities: characterToUpdate.qualities,
        weaknesses: characterToUpdate.weaknesses,
        biography: characterToUpdate.biography,
        plannedTimeline: characterToUpdate.plannedTimeline,
        isFavorite: characterToUpdate.isFavorite,
        extraNotes: characterToUpdate.extraNotes,
        createdAt: characterToUpdate.createdAt,
        updatedAt: characterToUpdate.updatedAt,
      })
    }

    await this.characterRepository.updateMany(updatedCharacters)

    return characterResponses
  }
}
