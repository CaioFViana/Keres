import { ISceneRepository } from '@domain/repositories/ISceneRepository';
import { SceneResponse } from '@keres/shared';

export class GetScenesByChapterIdUseCase {
  constructor(private readonly sceneRepository: ISceneRepository) {}

  async execute(chapterId: string): Promise<SceneResponse[]> {
    const scenes = await this.sceneRepository.findByChapterId(chapterId);
    return scenes.map(scene => ({
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
    }));
  }
}