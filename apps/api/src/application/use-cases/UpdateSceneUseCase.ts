import { UpdateSceneDTO, SceneProfileDTO } from '@application/dtos/SceneDTOs';
import { ISceneRepository } from '@domain/repositories/ISceneRepository';

export class UpdateSceneUseCase {
  constructor(private readonly sceneRepository: ISceneRepository) {}

  async execute(data: UpdateSceneDTO): Promise<SceneProfileDTO | null> {
    const existingScene = await this.sceneRepository.findById(data.id);
    if (!existingScene || existingScene.chapterId !== data.chapterId) {
      // Scene not found or does not belong to the specified chapter
      return null;
    }

    const updatedScene = {
      ...existingScene,
      name: data.name ?? existingScene.name,
      index: data.index ?? existingScene.index,
      summary: data.summary ?? existingScene.summary,
      gap: data.gap ?? existingScene.gap,
      duration: data.duration ?? existingScene.duration,
      isFavorite: data.isFavorite ?? existingScene.isFavorite,
      extraNotes: data.extraNotes ?? existingScene.extraNotes,
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
