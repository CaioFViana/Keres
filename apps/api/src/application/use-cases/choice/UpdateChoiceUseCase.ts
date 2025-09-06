import type { ChoiceProfileDTO, UpdateChoiceDTO } from '@application/dtos/ChoiceDTOs'
import type { Choice } from '@domain/entities/Choice'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Import
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import

export class UpdateChoiceUseCase {
  constructor(
    private choiceRepository: IChoiceRepository,
    private sceneRepository: ISceneRepository,
    private chapterRepository: IChapterRepository,
    private storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string, id: string, data: UpdateChoiceDTO): Promise<ChoiceProfileDTO> {
    const existingChoice = await this.choiceRepository.findById(id)
    if (!existingChoice) {
      throw new Error('Choice not found')
    }

    // Verify scene ownership
    const scene = await this.sceneRepository.findById(existingChoice.sceneId)
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

    const updatedChoice = await this.choiceRepository.update(id, data, existingChoice.sceneId)
    if (!updatedChoice) {
      throw new Error('Failed to update choice')
    }
    return this.mapToProfileDTO(updatedChoice)
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
