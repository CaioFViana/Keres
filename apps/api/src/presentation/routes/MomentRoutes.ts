import { Hono } from 'hono';
import { MomentController } from '@presentation/controllers/MomentController';
import {
  CreateMomentUseCase,
  GetMomentUseCase,
  GetMomentsBySceneIdUseCase,
  UpdateMomentUseCase,
  DeleteMomentUseCase,
} from '@application/use-cases';
import { MomentRepository } from '@infrastructure/persistence/MomentRepository';

const momentRoutes = new Hono();

// Dependencies for MomentController
const momentRepository = new MomentRepository();
const createMomentUseCase = new CreateMomentUseCase(momentRepository);
const getMomentUseCase = new GetMomentUseCase(momentRepository);
const getMomentsBySceneIdUseCase = new GetMomentsBySceneIdUseCase(momentRepository);
const updateMomentUseCase = new UpdateMomentUseCase(momentRepository);
const deleteMomentUseCase = new DeleteMomentUseCase(momentRepository);

const momentController = new MomentController(
  createMomentUseCase,
  getMomentUseCase,
  getMomentsBySceneIdUseCase,
  updateMomentUseCase,
  deleteMomentUseCase
);

momentRoutes.post('/', (c) => momentController.createMoment(c));
momentRoutes.get('/:id', (c) => momentController.getMoment(c));
momentRoutes.get('/scene/:sceneId', (c) => momentController.getMomentsBySceneId(c));
momentRoutes.put('/:id', (c) => momentController.updateMoment(c));
momentRoutes.delete('/:id', (c) => momentController.deleteMoment(c));

export default momentRoutes;
