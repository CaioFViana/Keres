import { ISceneRepository } from '@domain/repositories/ISceneRepository';
import { SceneUpdatePayload, SceneResponse } from '@keres/shared';

export class UpdateSceneUseCase {
  constructor(private readonly sceneRepository: ISceneRepository) {}

  async execute(data: SceneUpdatePayload): Promise<SceneResponse | null> {
    const existingScene = await this.sceneRepository.findById(data.id);
    if (!existingScene) {
      return null; // Scene not found
    }
    // Add ownership check
    if (data.chapterId && existingScene.chapterId !== data.chapterId) {
      return null; // Scene does not belong to this chapter
    }

    const updatedScene = {
      ...existingScene,
      ...data,
      updatedAt: new Date(),
    };

    await this.sceneRepository.update(updatedScene);

    return {
      id: updatedScene.id,
      chapterId: updatedScene.chapterId,
      name: updatedScene.name,
      index: updatedScene.index,
      summary: updatedScene.summary,
      gap: updatedScene.gap,
      duration: updatedScene.duration,
      isFavorite: updatedScene.isFavorite,
      extraNotes: updatedScene.extraNotes,
      createdAt: updatedScene.createdAt,
      updatedAt: updatedScene.updatedAt,
    };
  }
}