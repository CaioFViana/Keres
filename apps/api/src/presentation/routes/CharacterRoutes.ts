import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateCharacterUseCase,
  GetCharacterUseCase,
  UpdateCharacterUseCase,
  DeleteCharacterUseCase,
  GetCharactersByStoryIdUseCase,
} from '@application/use-cases';
import { CharacterRepository } from '@infrastructure/persistence/CharacterRepository';
import { CharacterController } from '@presentation/controllers/CharacterController';
import { CharacterCreateSchema, CharacterUpdateSchema } from '@keres/shared';

console.log('Initializing CharacterRoutes...');

const characterRoutes = new Hono();

// Dependencies for CharacterController
console.log('Instantiating CharacterRepository...');
const characterRepository = new CharacterRepository();
console.log('Instantiating CreateCharacterUseCase...');
const createCharacterUseCase = new CreateCharacterUseCase(characterRepository);
console.log('Instantiating GetCharacterUseCase...');
const getCharacterUseCase = new GetCharacterUseCase(characterRepository);
console.log('Instantiating UpdateCharacterUseCase...');
const updateCharacterUseCase = new UpdateCharacterUseCase(characterRepository);
console.log('Instantiating DeleteCharacterUseCase...');
const deleteCharacterUseCase = new DeleteCharacterUseCase(characterRepository);
console.log('Instantiating GetCharactersByStoryIdUseCase...');
const getCharactersByStoryIdUseCase = new GetCharactersByStoryIdUseCase(characterRepository);

console.log('Instantiating CharacterController...');
const characterController = new CharacterController(
  createCharacterUseCase,
  getCharacterUseCase,
  updateCharacterUseCase,
  deleteCharacterUseCase,
  getCharactersByStoryIdUseCase
);

characterRoutes.post('/', zValidator('json', CharacterCreateSchema), (c) => characterController.createCharacter(c));
characterRoutes.get('/:id', (c) => characterController.getCharacter(c));
characterRoutes.get('/story/:storyId', (c) => characterController.getCharactersByStoryId(c));
characterRoutes.put('/:id', zValidator('json', CharacterUpdateSchema), (c) => characterController.updateCharacter(c));
characterRoutes.delete('/:id', (c) => characterController.deleteCharacter(c));

console.log('CharacterRoutes initialized.');

export default characterRoutes;