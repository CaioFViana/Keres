import { Hono } from 'hono';
import { RelationController } from '@presentation/controllers/RelationController';
import {
  CreateRelationUseCase,
  GetRelationUseCase,
  GetRelationsByCharIdUseCase,
  UpdateRelationUseCase,
  DeleteRelationUseCase,
} from '@application/use-cases';
import { RelationRepository } from '@infrastructure/persistence/RelationRepository';

const relationRoutes = new Hono();

// Dependencies for RelationController
const relationRepository = new RelationRepository();
const createRelationUseCase = new CreateRelationUseCase(relationRepository);
const getRelationUseCase = new GetRelationUseCase(relationRepository);
const getRelationsByCharIdUseCase = new GetRelationsByCharIdUseCase(relationRepository);
const updateRelationUseCase = new UpdateRelationUseCase(relationRepository);
const deleteRelationUseCase = new DeleteRelationUseCase(relationRepository);

const relationController = new RelationController(
  createRelationUseCase,
  getRelationUseCase,
  getRelationsByCharIdUseCase,
  updateRelationUseCase,
  deleteRelationUseCase
);

relationRoutes.post('/', (c) => relationController.createRelation(c));
relationRoutes.get('/:id', (c) => relationController.getRelation(c));
relationRoutes.get('/character/:charId', (c) => relationController.getRelationsByCharId(c));
relationRoutes.put('/:id', (c) => relationController.updateRelation(c));
relationRoutes.delete('/:id', (c) => relationController.deleteRelation(c));

export default relationRoutes;
