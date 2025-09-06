import type { ChoiceProfileDTO, CreateChoiceDTO } from '@application/dtos/ChoiceDTOs'
import type { Choice } from '@domain/entities/Choice'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

export class CreateChoiceUseCase {
  constructor(
    private choiceRepository: IChoiceRepository,
    private sceneRepository: ISceneRepository, // Inject
    private chapterRepository: IChapterRepository, // Inject
    private storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, data: CreateChoiceDTO): Promise<ChoiceProfileDTO> {
    // Verify scene ownership
    const scene = await this.sceneRepository.findById(data.sceneId)
    if (!scene) {
      throw new Error('Scene not found')
    }
    const sceneChapter = await this.chapterRepository.findById(scene.chapterId)
    if (!sceneChapter) {
      throw new Error("Scene's chapter not found")
    }
    const sceneStory = await this.storyRepository.findById(sceneChapter.storyId, userId)
    if (!sceneStory) {
      throw new Error("Scene's story not found or not owned by user")
    }

    // Verify nextScene ownership
    const nextScene = await this.sceneRepository.findById(data.nextSceneId)
    if (!nextScene) {
      throw new Error('Next scene not found')
    }
    const nextSceneChapter = await this.chapterRepository.findById(nextScene.chapterId)
    if (!nextSceneChapter) {
      throw new Error("Next scene's chapter not found")
    }
    const nextSceneStory = await this.storyRepository.findById(nextSceneChapter.storyId, userId)
    if (!nextSceneStory) {
      throw new Error("Next scene's story not found or not owned by user")
    }

    // Verify that both scenes belong to the same story
    if (sceneChapter.storyId !== nextSceneChapter.storyId) {
      throw new Error('Scenes do not belong to the same story')
    }

    const newChoice = await this.choiceRepository.create(data)
    return this.mapToProfileDTO(newChoice)
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
