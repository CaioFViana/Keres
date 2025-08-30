import type { Scene } from '@domain/entities/Scene'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { SceneCreatePayload, SceneResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateSceneUseCase {
  constructor(private readonly sceneRepository: ISceneRepository) {}

  async execute(data: SceneCreatePayload): Promise<SceneResponse> {
    const newScene: Scene = {
      id: ulid(),
      chapterId: data.chapterId,
      name: data.name,
      index: data.index,
      summary: data.summary || null,
      gap: data.gap || null,
      duration: data.duration || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.sceneRepository.save(newScene)

    return {
      id: newScene.id,
      chapterId: newScene.chapterId,
      name: newScene.name,
      index: newScene.index,
      summary: newScene.summary,
      gap: newScene.gap,
      duration: newScene.duration,
      isFavorite: newScene.isFavorite,
      extraNotes: newScene.extraNotes,
      createdAt: newScene.createdAt,
      updatedAt: newScene.updatedAt,
    }
  }
}
