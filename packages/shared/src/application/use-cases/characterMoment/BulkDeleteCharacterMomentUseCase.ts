import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { BulkDeleteCharacterMomentResponse } from 'schemas'

export class BulkDeleteCharacterMomentUseCase {
  constructor(
    private readonly characterMomentRepository: ICharacterMomentRepository,
    private readonly characterRepository: ICharacterRepository,
    private readonly momentRepository: IMomentRepository,
    private readonly sceneRepository: ISceneRepository,
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(
    userId: string,
    ids: { characterId: string; momentId: string }[],
  ): Promise<BulkDeleteCharacterMomentResponse> {
    const successfulIds: { characterId: string; momentId: string }[] = []
    const failedIds: { characterId: string; momentId: string; reason: string }[] = []

    for (const { characterId, momentId } of ids) {
      try {
        const existingCharacterMoment = await this.characterMomentRepository.findById(
          characterId,
          momentId,
        )
        if (!existingCharacterMoment) {
          failedIds.push({ characterId, momentId, reason: 'CharacterMoment not found' })
          continue
        }

        const character = await this.characterRepository.findById(characterId)
        if (!character) {
          failedIds.push({ characterId, momentId, reason: 'Character not found' })
          continue
        }

        const moment = await this.momentRepository.findById(momentId)
        if (!moment) {
          failedIds.push({ characterId, momentId, reason: 'Moment not found' })
          continue
        }

        const characterStory = await this.storyRepository.findById(character.storyId, userId)
        if (!characterStory) {
          failedIds.push({
            characterId,
            momentId,
            reason: "Character's story not found or not owned by user",
          })
          continue
        }

        const momentScene = await this.sceneRepository.findById(moment.sceneId)
        if (!momentScene) {
          failedIds.push({ characterId, momentId, reason: "Moment's scene not found" })
          continue
        }
        const momentChapter = await this.chapterRepository.findById(momentScene.chapterId)
        if (!momentChapter) {
          failedIds.push({ characterId, momentId, reason: "Moment's chapter not found" })
          continue
        }
        const momentStory = await this.storyRepository.findById(momentChapter.storyId, userId)
        if (!momentStory) {
          failedIds.push({
            characterId,
            momentId,
            reason: "Moment's story not found or not owned by user",
          })
          continue
        }

        if (character.storyId !== momentChapter.storyId) {
          failedIds.push({
            characterId,
            momentId,
            reason: 'Character and Moment do not belong to the same story',
          })
          continue
        }

        await this.characterMomentRepository.delete(characterId, momentId)
        successfulIds.push({ characterId, momentId })
      } catch (error: unknown) {
        failedIds.push({
          characterId,
          momentId,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return { successfulIds, failedIds }
  }
}
