import { Hono } from 'hono';
import { CharacterMomentController } from '@presentation/controllers/CharacterMomentController';
import {
  CreateCharacterMomentUseCase,
  GetCharacterMomentsByCharacterIdUseCase,
  GetCharacterMomentsByMomentIdUseCase,
  DeleteCharacterMomentUseCase,
} from '@application/use-cases';
import { CharacterMomentRepository } from '@infrastructure/persistence/CharacterMomentRepository';

const characterMomentRoutes = new Hono();

// Dependencies for CharacterMomentController
const characterMomentRepository = new CharacterMomentRepository();
const createCharacterMomentUseCase = new CreateCharacterMomentUseCase(characterMomentRepository);
const getCharacterMomentsByCharacterIdUseCase = new GetCharacterMomentsByCharacterIdUseCase(characterMomentRepository);
const getCharacterMomentsByMomentIdUseCase = new GetCharacterMomentsByMomentIdUseCase(characterMomentRepository);
const deleteCharacterMomentUseCase = new DeleteCharacterMomentUseCase(characterMomentRepository);

const characterMomentController = new CharacterMomentController(
  createCharacterMomentUseCase,
  getCharacterMomentsByCharacterIdUseCase,
  getCharacterMomentsByMomentIdUseCase,
  deleteCharacterMomentUseCase
);

characterMomentRoutes.post('/', (c) => characterMomentController.createCharacterMoment(c));
characterMomentRoutes.get('/character/:characterId', (c) => characterMomentController.getCharacterMomentsByCharacterId(c));
characterMomentRoutes.get('/moment/:momentId', (c) => characterMomentController.getCharacterMomentsByMomentId(c));
characterMomentRoutes.delete('/character/:characterId/moment/:momentId', (c) => characterMomentController.deleteCharacterMoment(c));

export default characterMomentRoutes;
