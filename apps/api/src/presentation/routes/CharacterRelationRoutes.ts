import { Hono } from 'hono';
import { CharacterRelationController } from '@presentation/controllers/CharacterRelationController';
import {
  CreateCharacterRelationUseCase,
  GetCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
  UpdateCharacterRelationUseCase,
  DeleteCharacterRelationUseCase,
} from '@application/use-cases';
import { CharacterRelationRepository } from '@infrastructure/persistence/CharacterRelationRepository';

const characterRelationRoutes = new Hono();

// Dependencies for CharacterRelationController
const characterRelationRepository = new CharacterRelationRepository();
const createCharacterRelationUseCase = new CreateCharacterRelationUseCase(characterRelationRepository);
const getCharacterRelationUseCase = new GetCharacterRelationUseCase(characterRelationRepository);
const getCharacterRelationsByCharIdUseCase = new GetCharacterRelationsByCharIdUseCase(characterRelationRepository);
const updateCharacterRelationUseCase = new UpdateCharacterRelationUseCase(characterRelationRepository);
const deleteCharacterRelationUseCase = new DeleteCharacterRelationUseCase(characterRelationRepository);

const characterRelationController = new CharacterRelationController(
  createCharacterRelationUseCase,
  getCharacterRelationUseCase,
  getCharacterRelationsByCharIdUseCase,
  updateCharacterRelationUseCase,
  deleteCharacterRelationUseCase
);

characterRelationRoutes.post('/', (c) => characterRelationController.createCharacterRelation(c));
characterRelationRoutes.get('/:id', (c) => characterRelationController.getCharacterRelation(c));
characterRelationRoutes.get('/character/:charId', (c) => characterRelationController.getCharacterRelationsByCharId(c));
characterRelationRoutes.put('/:id', (c) => characterRelationController.updateCharacterRelation(c));
characterRelationRoutes.delete('/:id', (c) => characterRelationController.deleteCharacterRelation(c));

export default characterRelationRoutes;
