import type {
  CreateSceneUseCase,
  DeleteSceneUseCase,
  GetScenesByChapterIdUseCase,
  GetSceneUseCase,
  UpdateSceneUseCase,
} from '@application/use-cases'

import { SceneCreateSchema, SceneResponseSchema, SceneUpdateSchema } from '@keres/shared'
import z from 'zod'

export class SceneController {
  constructor(
    private readonly createSceneUseCase: CreateSceneUseCase,
    private readonly getSceneUseCase: GetSceneUseCase,
    private readonly updateSceneUseCase: UpdateSceneUseCase,
    private readonly deleteSceneUseCase: DeleteSceneUseCase,
    private readonly getScenesByChapterIdUseCase: GetScenesByChapterIdUseCase,
  ) {}

  async createScene(data: z.infer<typeof SceneCreateSchema>) {
    const scene = await this.createSceneUseCase.execute(data)
    return SceneResponseSchema.parse(scene)
  }

  async getScene(id: string) {
    const scene = await this.getSceneUseCase.execute(id)
    if (!scene) {
      throw new Error('Scene not found')
    }
    return SceneResponseSchema.parse(scene)
  }

  async getScenesByChapterId(chapterId: string) {
    const scenes = await this.getScenesByChapterIdUseCase.execute(chapterId)
    return scenes.map((scene) => SceneResponseSchema.parse(scene))
  }

  async updateScene(id: string, data: z.infer<typeof SceneUpdateSchema>) {
    const updatedScene = await this.updateSceneUseCase.execute({ id, ...data })
    if (!updatedScene) {
      throw new Error('Scene not found or does not belong to the specified chapter')
    }
    return SceneResponseSchema.parse(updatedScene)
  }

  async deleteScene(id: string, chapterId: string) {
    if (!chapterId) {
      throw new Error('chapterId is required for deletion')
    }
    const deleted = await this.deleteSceneUseCase.execute(id, chapterId)
    if (!deleted) {
      throw new Error('Scene not found or does not belong to the specified chapter')
    }
    return
  }
}
