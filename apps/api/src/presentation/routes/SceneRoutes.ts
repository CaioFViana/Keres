import {
  CreateSceneUseCase,
  DeleteSceneUseCase,
  GetScenesByChapterIdUseCase,
  GetSceneUseCase,
  UpdateSceneUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { SceneRepository } from '@infrastructure/persistence/SceneRepository'
import { SceneCreateSchema, SceneUpdateSchema } from '@keres/shared'
import { SceneController } from '@presentation/controllers/SceneController'
import { Hono } from 'hono'

console.log('Initializing SceneRoutes...')

const sceneRoutes = new Hono()

// Dependencies for SceneController
console.log('Instantiating SceneRepository...')
const sceneRepository = new SceneRepository()
console.log('Instantiating CreateSceneUseCase...')
const createSceneUseCase = new CreateSceneUseCase(sceneRepository)
console.log('Instantiating GetSceneUseCase...')
const getSceneUseCase = new GetSceneUseCase(sceneRepository)
console.log('Instantiating UpdateSceneUseCase...')
const updateSceneUseCase = new UpdateSceneUseCase(sceneRepository)
console.log('Instantiating DeleteSceneUseCase...')
const deleteSceneUseCase = new DeleteSceneUseCase(sceneRepository)
console.log('Instantiating GetScenesByChapterIdUseCase...')
const getScenesByChapterIdUseCase = new GetScenesByChapterIdUseCase(sceneRepository)

console.log('Instantiating SceneController...')
const sceneController = new SceneController(
  createSceneUseCase,
  getSceneUseCase,
  updateSceneUseCase,
  deleteSceneUseCase,
  getScenesByChapterIdUseCase,
)

sceneRoutes.post('/', zValidator('json', SceneCreateSchema), (c) => sceneController.createScene(c))
sceneRoutes.get('/:id', (c) => sceneController.getScene(c))
sceneRoutes.get('/chapter/:chapterId', (c) => sceneController.getScenesByChapterId(c))
sceneRoutes.put('/:id', zValidator('json', SceneUpdateSchema), (c) =>
  sceneController.updateScene(c),
)
sceneRoutes.delete('/:id', (c) => sceneController.deleteScene(c))

console.log('SceneRoutes initialized.')

export default sceneRoutes
