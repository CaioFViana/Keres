import { Hono } from 'hono';
import { CharacterController } from '@presentation/controllers/CharacterController';
import {
  CreateCharacterUseCase,
  GetCharacterUseCase,
  GetCharactersByStoryIdUseCase,
  UpdateCharacterUseCase,
  DeleteCharacterUseCase,
} from '@application/use-cases';
import { CharacterRepository } from '@infrastructure/persistence/CharacterRepository';

const characterRoutes = new Hono();

// Dependencies for CharacterController
const characterRepository = new CharacterRepository();
const createCharacterUseCase = new CreateCharacterUseCase(characterRepository);
const getCharacterUseCase = new GetCharacterUseCase(characterRepository);
const getCharactersByStoryIdUseCase = new GetCharactersByStoryIdUseCase(characterRepository);
const updateCharacterUseCase = new UpdateCharacterUseCase(characterRepository);
const deleteCharacterUseCase = new DeleteCharacterUseCase(characterRepository);

const characterController = new CharacterController(
  createCharacterUseCase,
  getCharacterUseCase,
  getCharactersByStoryIdUseCase,
  updateCharacterUseCase,
  deleteCharacterUseCase
);

characterRoutes.post('/', (c) => characterController.createCharacter(c));
characterRoutes.get('/:id', (c) => characterController.getCharacter(c));
characterRoutes.get('/story/:storyId', (c) => characterController.getCharactersByStoryId(c));
characterRoutes.put('/:id', (c) => characterController.updateCharacter(c));
characterRoutes.delete('/:id', (c) => characterController.deleteCharacter(c));

export default characterRoutes;
