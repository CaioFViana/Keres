import { ISceneRepository } from '@domain/repositories/ISceneRepository';

export class DeleteSceneUseCase {
  constructor(private readonly sceneRepository: ISceneRepository) {}

  async execute(sceneId: string, chapterId: string): Promise<boolean> {
    const existingScene = await this.sceneRepository.findById(sceneId);
    if (!existingScene || existingScene.chapterId !== chapterId) {
      // Scene not found or does not belong to the specified chapter
      return false;
    }

    await this.sceneRepository.delete(sceneId);
    return true;
  }
}
