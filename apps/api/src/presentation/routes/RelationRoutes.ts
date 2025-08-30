import {
  CreateRelationUseCase,
  DeleteRelationUseCase,
  GetRelationsByCharIdUseCase,
  GetRelationUseCase,
  UpdateRelationUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { RelationRepository } from '@infrastructure/persistence/RelationRepository'
import { RelationCreateSchema, RelationUpdateSchema } from '@keres/shared'
import { RelationController } from '@presentation/controllers/RelationController'
import { Hono } from 'hono'

console.log('Initializing RelationRoutes...')

const relationRoutes = new Hono()

// Dependencies for RelationController
console.log('Instantiating RelationRepository...')
const relationRepository = new RelationRepository()
console.log('Instantiating CreateRelationUseCase...')
const createRelationUseCase = new CreateRelationUseCase(relationRepository)
console.log('Instantiating GetRelationUseCase...')
const getRelationUseCase = new GetRelationUseCase(relationRepository)
console.log('Instantiating UpdateRelationUseCase...')
const updateRelationUseCase = new UpdateRelationUseCase(relationRepository)
console.log('Instantiating DeleteRelationUseCase...')
const deleteRelationUseCase = new DeleteRelationUseCase(relationRepository)
console.log('Instantiating GetRelationsByCharIdUseCase...')
const getRelationsByCharIdUseCase = new GetRelationsByCharIdUseCase(relationRepository)

console.log('Instantiating RelationController...')
const relationController = new RelationController(
  createRelationUseCase,
  getRelationUseCase,
  updateRelationUseCase,
  deleteRelationUseCase,
  getRelationsByCharIdUseCase,
)

relationRoutes.post('/', zValidator('json', RelationCreateSchema), (c) =>
  relationController.createRelation(c),
)
relationRoutes.get('/:id', (c) => relationController.getRelation(c))
relationRoutes.get('/character/:charId', (c) => relationController.getRelationsByCharId(c))
relationRoutes.put('/:id', zValidator('json', RelationUpdateSchema), (c) =>
  relationController.updateRelation(c),
)
relationRoutes.delete('/:id', (c) => relationController.deleteRelation(c))

console.log('RelationRoutes initialized.')

export default relationRoutes
