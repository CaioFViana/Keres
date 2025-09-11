import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

export class DeleteChapterUseCase {
  constructor(
    private readonly chapterRepository: IChapterRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly sceneRepository: ISceneRepository,
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingChapter = await this.chapterRepository.findById(id)
    if (!existingChapter) {
      throw new Error('Chapter not found')
    }

    const scenes = await this.sceneRepository.findByChapterId(id)
    if (scenes.totalItems > 0) {
      throw new Error('Chapter cannot be deleted because it has associated scenes.')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingChapter.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    await this.chapterRepository.delete(id, existingChapter.storyId)
    return true
  }
}
