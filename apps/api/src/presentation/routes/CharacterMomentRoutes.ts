import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateCharacterMomentUseCase,
  GetCharacterMomentsByCharacterIdUseCase,
  GetCharacterMomentsByMomentIdUseCase,
  DeleteCharacterMomentUseCase,
} from '@application/use-cases';
import { CharacterMomentRepository } from '@infrastructure/persistence/CharacterMomentRepository';
import { CharacterMomentController } from '@presentation/controllers/CharacterMomentController';
import { CharacterMomentCreateSchema } from '@keres/shared';

console.log('Initializing CharacterMomentRoutes...');

const characterMomentRoutes = new Hono();

// Dependencies for CharacterMomentController
console.log('Instantiating CharacterMomentRepository...');
const characterMomentRepository = new CharacterMomentRepository();
console.log('Instantiating CreateCharacterMomentUseCase...');
const createCharacterMomentUseCase = new CreateCharacterMomentUseCase(characterMomentRepository);
console.log('Instantiating GetCharacterMomentsByCharacterIdUseCase...');
const getCharacterMomentsByCharacterIdUseCase = new GetCharacterMomentsByCharacterIdUseCase(characterMomentRepository);
console.log('Instantiating GetCharacterMomentsByMomentIdUseCase...');
const getCharacterMomentsByMomentIdUseCase = new GetCharacterMomentsByMomentIdUseCase(characterMomentRepository);
console.log('Instantiating DeleteCharacterMomentUseCase...');
const deleteCharacterMomentUseCase = new DeleteCharacterMomentUseCase(characterMomentRepository);

console.log('Instantiating CharacterMomentController...');
const characterMomentController = new CharacterMomentController(
  createCharacterMomentUseCase,
  getCharacterMomentsByCharacterIdUseCase,
  getCharacterMomentsByMomentIdUseCase,
  deleteCharacterMomentUseCase
);

characterMomentRoutes.post('/', zValidator('json', CharacterMomentCreateSchema), (c) => characterMomentController.createCharacterMoment(c));
characterMomentRoutes.get('/character/:characterId', (c) => characterMomentController.getCharacterMomentsByCharacterId(c));
characterMomentRoutes.get('/moment/:momentId', (c) => characterMomentController.getCharacterMomentsByMomentId(c));
characterMomentRoutes.delete('/', (c) => characterMomentController.deleteCharacterMoment(c));

console.log('CharacterMomentRoutes initialized.');

export default characterMomentRoutes;