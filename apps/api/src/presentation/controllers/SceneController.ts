import type {
  CreateSceneUseCase,
  DeleteSceneUseCase,
  GetScenesByChapterIdUseCase,
  GetSceneUseCase,
  UpdateSceneUseCase,
} from '@application/use-cases'
import type { Context } from 'hono'

import { SceneResponseSchema } from '@keres/shared'

export class SceneController {
  constructor(
    private readonly createSceneUseCase: CreateSceneUseCase,
    private readonly getSceneUseCase: GetSceneUseCase,
    private readonly updateSceneUseCase: UpdateSceneUseCase,
    private readonly deleteSceneUseCase: DeleteSceneUseCase,
    private readonly getScenesByChapterIdUseCase: GetScenesByChapterIdUseCase,
  ) {}

  async createScene(c: Context) {
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const scene = await this.createSceneUseCase.execute(data)
      return c.json(SceneResponseSchema.parse(scene), 201)
    } catch (_error: unknown) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getScene(c: Context) {
    const sceneId = c.req.param('id')

    try {
      const scene = await this.getSceneUseCase.execute(sceneId)
      if (!scene) {
        return c.json({ error: 'Scene not found' }, 404)
      }
      return c.json(SceneResponseSchema.parse(scene), 200)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async getScenesByChapterId(c: Context) {
    const chapterId = c.req.param('chapterId') // Assuming chapterId is passed as a param

    try {
      const scenes = await this.getScenesByChapterIdUseCase.execute(chapterId)
      return c.json(
        scenes.map((scene) => SceneResponseSchema.parse(scene)),
        200,
      )
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async updateScene(c: Context) {
    const sceneId = c.req.param('id')
    const data = c.req.valid('json') // Validated by zValidator middleware

    try {
      const updatedScene = await this.updateSceneUseCase.execute({ id: sceneId, ...data })
      if (!updatedScene) {
        return c.json({ error: 'Scene not found or does not belong to the specified chapter' }, 404)
      }
      return c.json(SceneResponseSchema.parse(updatedScene), 200)
    } catch (_error: unknown) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }

  async deleteScene(c: Context) {
    const sceneId = c.req.param('id')
    const chapterId = c.req.query('chapterId') // Assuming chapterId is passed as a query param for delete

    if (!chapterId) {
      return c.json({ error: 'chapterId is required for deletion' }, 400)
    }

    try {
      const deleted = await this.deleteSceneUseCase.execute(sceneId, chapterId)
      if (!deleted) {
        return c.json({ error: 'Scene not found or does not belong to the specified chapter' }, 404)
      }
      return c.json({}, 204)
    } catch (_error) {
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  }
}
