import { ISceneRepository } from '@domain/repositories/ISceneRepository';
import { SceneResponse } from '@keres/shared';

export class GetSceneUseCase {
  constructor(private readonly sceneRepository: ISceneRepository) {}

  async execute(id: string): Promise<SceneResponse | null> {
    const scene = await this.sceneRepository.findById(id);
    if (!scene) {
      return null;
    }

    return {
      id: scene.id,
      chapterId: scene.chapterId,
      name: scene.name,
      index: scene.index,
      summary: scene.summary,
      gap: scene.gap,
      duration: scene.duration,
      isFavorite: scene.isFavorite,
      extraNotes: scene.extraNotes,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
    };
  }
}