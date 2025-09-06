import type { ChoiceProfileDTO } from '@application/dtos/ChoiceDTOs'
import type { Choice } from '@domain/entities/Choice'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import

export class GetChoiceUseCase {
  constructor(
    private choiceRepository: IChoiceRepository,
    private sceneRepository: ISceneRepository, // Inject
    private chapterRepository: IChapterRepository, // Inject
    private storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, id: string): Promise<ChoiceProfileDTO> {
    const choice = await this.choiceRepository.findById(id)
    if (!choice) {
      throw new Error('Choice not found')
    }

    // Verify scene ownership
    const scene = await this.sceneRepository.findById(choice.sceneId)
    if (!scene) {
      throw new Error('Scene not found for choice')
    }
    const chapter = await this.chapterRepository.findById(scene.chapterId)
    if (!chapter) {
      throw new Error('Chapter not found for scene')
    }
    const story = await this.storyRepository.findById(chapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user for choice')
    }

    return this.mapToProfileDTO(choice)
  }

  private mapToProfileDTO(choice: Choice): ChoiceProfileDTO {
    return {
      id: choice.id,
      sceneId: choice.sceneId,
      nextSceneId: choice.nextSceneId,
      text: choice.text,
      isImplicit: choice.isImplicit,
      createdAt: choice.createdAt,
      updatedAt: choice.updatedAt,
    }
  }
}
