import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import
import type { ICharacterMomentRepository } from '@domain/repositories/ICharacterMomentRepository'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository' // Import
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import
import type { CharacterMomentResponse } from '@keres/shared'

export class GetCharacterMomentsByMomentIdUseCase {
  constructor(
    private readonly characterMomentRepository: ICharacterMomentRepository,
    private readonly momentRepository: IMomentRepository, // Inject
    private readonly sceneRepository: ISceneRepository, // Inject
    private readonly chapterRepository: IChapterRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, momentId: string): Promise<CharacterMomentResponse[]> {
    // Verify moment ownership
    const moment = await this.momentRepository.findById(momentId)
    if (!moment) {
      throw new Error('Moment not found')
    }
    const scene = await this.sceneRepository.findById(moment.sceneId)
    if (!scene) {
      throw new Error('Scene not found')
    }
    const chapter = await this.chapterRepository.findById(scene.chapterId)
    if (!chapter) {
      throw new Error('Chapter not found')
    }
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const characterMoments = await this.characterMomentRepository.findByMomentId(momentId)
    return characterMoments.map((cm) => ({
      characterId: cm.characterId,
      momentId: cm.momentId,
      createdAt: cm.createdAt,
      updatedAt: cm.updatedAt,
    }))
  }
}
