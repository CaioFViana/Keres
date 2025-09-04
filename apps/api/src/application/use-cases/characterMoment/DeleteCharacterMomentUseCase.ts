import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Import
import type { IMomentRepository } from '@domain/repositories/IMomentRepository' // Import
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Import
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import

export class DeleteCharacterMomentUseCase {
  constructor(
    private readonly characterMomentRepository: ICharacterMomentRepository,
    private readonly characterRepository: ICharacterRepository, // Inject
    private readonly momentRepository: IMomentRepository, // Inject
    private readonly sceneRepository: ISceneRepository, // Inject
    private readonly chapterRepository: IChapterRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, characterId: string, momentId: string): Promise<boolean> {
    // Verify character ownership
    const character = await this.characterRepository.findById(characterId)
    if (!character) {
      throw new Error('Character not found')
    }

    // Verify moment ownership
    const moment = await this.momentRepository.findById(momentId)
    if (!moment) {
      throw new Error('Moment not found')
    }

    // Verify that character and moment belong to the same story
    const characterStory = await this.storyRepository.findById(character.storyId, userId)
    if (!characterStory) {
      throw new Error('Character\'s story not found or not owned by user')
    }

    const momentScene = await this.sceneRepository.findById(moment.sceneId)
    if (!momentScene) {
      throw new Error('Moment\'s scene not found')
    }
    const momentChapter = await this.chapterRepository.findById(momentScene.chapterId)
    if (!momentChapter) {
      throw new Error('Moment\'s chapter not found')
    }
    const momentStory = await this.storyRepository.findById(momentChapter.storyId, userId)
    if (!momentStory) {
      throw new Error('Moment\'s story not found or not owned by user')
    }

    if (character.storyId !== momentChapter.storyId) {
      throw new Error('Character and Moment do not belong to the same story')
    }

    // Check if the character moment actually exists before attempting to delete
    const existingCharacterMoment = await this.characterMomentRepository.findById(characterId, momentId)
    if (!existingCharacterMoment) {
      throw new Error('CharacterMoment not found')
    }

    await this.characterMomentRepository.delete(characterId, momentId)
    return true
  }
}
