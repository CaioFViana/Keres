import {
  CreateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
  GetMomentUseCase,
  UpdateMomentUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { MomentRepository } from '@infrastructure/persistence/MomentRepository'
import { MomentCreateSchema, MomentUpdateSchema } from '@keres/shared'
import { MomentController } from '@presentation/controllers/MomentController'
import { Hono } from 'hono'

console.log('Initializing MomentRoutes...')

const momentRoutes = new Hono()

// Dependencies for MomentController
console.log('Instantiating MomentRepository...')
const momentRepository = new MomentRepository()
console.log('Instantiating CreateMomentUseCase...')
const createMomentUseCase = new CreateMomentUseCase(momentRepository)
console.log('Instantiating GetMomentUseCase...')
const getMomentUseCase = new GetMomentUseCase(momentRepository)
console.log('Instantiating UpdateMomentUseCase...')
const updateMomentUseCase = new UpdateMomentUseCase(momentRepository)
console.log('Instantiating DeleteMomentUseCase...')
const deleteMomentUseCase = new DeleteMomentUseCase(momentRepository)
console.log('Instantiating GetMomentsBySceneIdUseCase...')
const getMomentsBySceneIdUseCase = new GetMomentsBySceneIdUseCase(momentRepository)

console.log('Instantiating MomentController...')
const momentController = new MomentController(
  createMomentUseCase,
  getMomentUseCase,
  updateMomentUseCase,
  deleteMomentUseCase,
  getMomentsBySceneIdUseCase,
)

momentRoutes.post('/', zValidator('json', MomentCreateSchema), (c) =>
  momentController.createMoment(c),
)
momentRoutes.get('/:id', (c) => momentController.getMoment(c))
momentRoutes.get('/scene/:sceneId', (c) => momentController.getMomentsBySceneId(c))
momentRoutes.put('/:id', zValidator('json', MomentUpdateSchema), (c) =>
  momentController.updateMoment(c),
)
momentRoutes.delete('/:id', (c) => momentController.deleteMoment(c))

console.log('MomentRoutes initialized.')

export default momentRoutes
