import type { CharacterMoment } from '@domain/entities/CharacterMoment'
import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { CharacterMomentResponse, UpdateManyCharacterMomentsPayload } from '@keres/shared'

export class UpdateManyCharacterMomentsUseCase {
  constructor(
    private readonly characterMomentRepository: ICharacterMomentRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly momentRepository: IMomentRepository,
    private readonly sceneRepository: ISceneRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, data: UpdateManyCharacterMomentsPayload): Promise<CharacterMomentResponse[]> {
    if (data.length === 0) {
      return []
    }

    const updatedCharacterMoments: CharacterMoment[] = []
    const characterMomentResponses: CharacterMomentResponse[] = []

    for (const payload of data) {
      if (!payload.characterId || !payload.momentId) {
        throw new Error('characterId and momentId are required for batch update')
      }

      const existingCharacterMoment = await this.characterMomentRepository.findById(
        payload.characterId,
        payload.momentId,
      )
      if (!existingCharacterMoment) {
        throw new Error(
          `CharacterMoment with characterId ${payload.characterId} and momentId ${payload.momentId} not found`,
        )
      }

      // Validate character and moment existence and ownership
      const character = await this.characterRepository.findById(payload.characterId)
      if (!character) {
        throw new Error(`Character with ID ${payload.characterId} not found`)
      }
      const moment = await this.momentRepository.findById(payload.momentId)
      if (!moment) {
        throw new Error(`Moment with ID ${payload.momentId} not found`)
      }

      // Verify story ownership for both character and moment
      const characterStory = await this.storyRepository.findById(character.storyId, userId)
      if (!characterStory) {
        throw new Error(
          `Story for character ID ${payload.characterId} not found or not owned by user`,
        )
      }

      const scene = await this.sceneRepository.findById(moment.sceneId)
      if (!scene) {
        throw new Error(`Scene with ID ${moment.sceneId} not found`)
      }
      const chapter = await this.chapterRepository.findById(scene.chapterId)
      if (!chapter) {
        throw new Error(`Chapter with ID ${scene.chapterId} not found`)
      }
      const momentStory = await this.storyRepository.findById(chapter.storyId, userId)
      if (!momentStory) {
        throw new Error(
          `Story for moment ID ${payload.momentId} not found or not owned by user`,
        )
      }

      if (characterStory.id !== momentStory.id) {
        throw new Error('Character and Moment must belong to the same story')
      }

      const characterMomentToUpdate: CharacterMoment = {
        ...existingCharacterMoment,
        ...payload,
        updatedAt: new Date(),
      }
      updatedCharacterMoments.push(characterMomentToUpdate)
      characterMomentResponses.push({
        characterId: characterMomentToUpdate.characterId,
        momentId: characterMomentToUpdate.momentId,
        createdAt: characterMomentToUpdate.createdAt,
        updatedAt: characterMomentToUpdate.updatedAt,
      })
    }

    await this.characterMomentRepository.updateMany(updatedCharacterMoments)

    return characterMomentResponses
  }
}
