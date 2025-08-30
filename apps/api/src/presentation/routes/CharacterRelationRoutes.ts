import {
  CreateCharacterRelationUseCase,
  DeleteCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
  GetCharacterRelationUseCase,
  UpdateCharacterRelationUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { CharacterRelationRepository } from '@infrastructure/persistence/CharacterRelationRepository'
import { CharacterRelationCreateSchema, CharacterRelationUpdateSchema } from '@keres/shared'
import { CharacterRelationController } from '@presentation/controllers/CharacterRelationController'
import { Hono } from 'hono'

console.log('Initializing CharacterRelationRoutes...')

const characterRelationRoutes = new Hono()

// Dependencies for CharacterRelationController
console.log('Instantiating CharacterRelationRepository...')
const characterRelationRepository = new CharacterRelationRepository()
console.log('Instantiating CreateCharacterRelationUseCase...')
const createCharacterRelationUseCase = new CreateCharacterRelationUseCase(
  characterRelationRepository,
)
console.log('Instantiating GetCharacterRelationUseCase...')
const getCharacterRelationUseCase = new GetCharacterRelationUseCase(characterRelationRepository)
console.log('Instantiating UpdateCharacterRelationUseCase...')
const updateCharacterRelationUseCase = new UpdateCharacterRelationUseCase(
  characterRelationRepository,
)
console.log('Instantiating DeleteCharacterRelationUseCase...')
const deleteCharacterRelationUseCase = new DeleteCharacterRelationUseCase(
  characterRelationRepository,
)
console.log('Instantiating GetCharacterRelationsByCharIdUseCase...')
const getCharacterRelationsByCharIdUseCase = new GetCharacterRelationsByCharIdUseCase(
  characterRelationRepository,
)

console.log('Instantiating CharacterRelationController...')
const characterRelationController = new CharacterRelationController(
  createCharacterRelationUseCase,
  getCharacterRelationUseCase,
  updateCharacterRelationUseCase,
  deleteCharacterRelationUseCase,
  getCharacterRelationsByCharIdUseCase,
)

characterRelationRoutes.post('/', zValidator('json', CharacterRelationCreateSchema), (c) =>
  characterRelationController.createCharacterRelation(c),
)
characterRelationRoutes.get('/:id', (c) => characterRelationController.getCharacterRelation(c))
characterRelationRoutes.get('/character/:charId', (c) =>
  characterRelationController.getCharacterRelationsByCharId(c),
)
characterRelationRoutes.put('/:id', zValidator('json', CharacterRelationUpdateSchema), (c) =>
  characterRelationController.updateCharacterRelation(c),
)
characterRelationRoutes.delete('/:id', (c) =>
  characterRelationController.deleteCharacterRelation(c),
)

console.log('CharacterRelationRoutes initialized.')

export default characterRelationRoutes
