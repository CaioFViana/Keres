import { SceneProfileDTO } from '@application/dtos/SceneDTOs';
import { ISceneRepository } from '@domain/repositories/ISceneRepository';

export class GetSceneUseCase {
  constructor(private readonly sceneRepository: ISceneRepository) {}

  async execute(sceneId: string): Promise<SceneProfileDTO | null> {
    const scene = await this.sceneRepository.findById(sceneId);
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
