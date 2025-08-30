import type { ISceneRepository } from '@domain/repositories/ISceneRepository'

export class DeleteSceneUseCase {
  constructor(private readonly sceneRepository: ISceneRepository) {}

  async execute(id: string, chapterId: string): Promise<boolean> {
    const existingScene = await this.sceneRepository.findById(id)
    if (!existingScene) {
      return false // Scene not found
    }
    if (existingScene.chapterId !== chapterId) {
      // Check ownership
      return false // Scene does not belong to this chapter
    }
    await this.sceneRepository.delete(id)
    return true
  }
}
