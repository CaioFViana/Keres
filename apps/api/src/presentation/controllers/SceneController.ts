import type {
  BulkDeleteSceneUseCase,
  CreateSceneUseCase,
  DeleteSceneUseCase,
  GetScenesByChapterIdUseCase,
  GetScenesByLocationIdUseCase,
  GetSceneUseCase,
  UpdateSceneUseCase,
} from '@application/use-cases'
import type z from 'zod'

import {
  type ListQueryParams,
  type SceneCreateSchema,
  SceneResponseSchema,
  type SceneUpdateSchema,
} from '@keres/shared'

export class SceneController {
  constructor(
    private readonly createSceneUseCase: CreateSceneUseCase,
    private readonly getSceneUseCase: GetSceneUseCase,
    private readonly updateSceneUseCase: UpdateSceneUseCase,
    private readonly deleteSceneUseCase: DeleteSceneUseCase,
    private readonly bulkDeleteSceneUseCase: BulkDeleteSceneUseCase,
    private readonly getScenesByChapterIdUseCase: GetScenesByChapterIdUseCase,
    private readonly getScenesByLocationIdUseCase: GetScenesByLocationIdUseCase,
  ) {}

  async createScene(userId: string, data: z.infer<typeof SceneCreateSchema>) {
    const scene = await this.createSceneUseCase.execute(userId, data)
    return SceneResponseSchema.parse(scene)
  }

  async getScene(userId: string, id: string, include: string[] = []) {
    const scene = await this.getSceneUseCase.execute(userId, id, include)
    if (!scene) {
      throw new Error('Scene not found')
    }
    return SceneResponseSchema.parse(scene)
  }

  async getScenesByChapterId(userId: string, chapterId: string, query: ListQueryParams) {
    const scenes = await this.getScenesByChapterIdUseCase.execute(userId, chapterId, query)
    return scenes.map((scene) => SceneResponseSchema.parse(scene))
  }

  async getScenesByLocationId(userId: string, locationId: string, query: ListQueryParams) {
    const scenes = await this.getScenesByLocationIdUseCase.execute(userId, locationId, query)
    return scenes.map((scene) => SceneResponseSchema.parse(scene))
  }

  async updateScene(userId: string, id: string, data: z.infer<typeof SceneUpdateSchema>) {
    const { id: dataId, ...updateData } = data
    const updatedScene = await this.updateSceneUseCase.execute(userId, { id, ...updateData })
    if (!updatedScene) {
      throw new Error('Scene not found or does not belong to the specified chapter')
    }
    return SceneResponseSchema.parse(updatedScene)
  }

  async deleteScene(userId: string, id: string) {
    const deleted = await this.deleteSceneUseCase.execute(userId, id)
    if (!deleted) {
      throw new Error('Scene not found or does not belong to the specified chapter')
    }
    return
  }

  async bulkDeleteScenes(userId: string, ids: string[]) {
    const result = await this.bulkDeleteSceneUseCase.execute(userId, ids)
    return result
  }
}
