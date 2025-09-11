import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { ICharacterRelationRepository } from '@domain/repositories/ICharacterRelationRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { type CharacterResponse, MomentResponseSchema } from 'schemas'

export class GetCharacterUseCase {
  constructor(
    private readonly characterRepository: ICharacterRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly characterMomentRepository: ICharacterMomentRepository,
    private readonly characterRelationRepository: ICharacterRelationRepository,
    private readonly momentRepository: IMomentRepository, // New injection
  ) {}

  async execute(userId: string, id: string, include: string[] = []): Promise<CharacterResponse> {
    const character = await this.characterRepository.findById(id)
    if (!character) {
      throw new Error('Character not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(character.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const response: CharacterResponse = {
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

    if (include.includes('moments')) {
      const characterMoments = await this.characterMomentRepository.findByCharacterId(character.id)
      const momentIds = characterMoments.map((cm) => cm.momentId)
      const moments = await this.momentRepository.findByIds(momentIds)
      response.moments = moments.map((m) => MomentResponseSchema.parse(m)) // Map to MomentResponse
    }

    if (include.includes('relations')) {
      const relations = await this.characterRelationRepository.findByCharId(character.id)
      response.relations = relations // Assign to the response (assuming CharacterRelationResponse matches CharacterRelation entity)
    }

    return response
  }
}
