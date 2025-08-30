import { Hono } from 'hono';
import { SceneController } from '@presentation/controllers/SceneController';
import {
  CreateSceneUseCase,
  GetSceneUseCase,
  GetScenesByChapterIdUseCase,
  UpdateSceneUseCase,
  DeleteSceneUseCase,
} from '@application/use-cases';
import { SceneRepository } from '@infrastructure/persistence/SceneRepository';

const sceneRoutes = new Hono();

// Dependencies for SceneController
const sceneRepository = new SceneRepository();
const createSceneUseCase = new CreateSceneUseCase(sceneRepository);
const getSceneUseCase = new GetSceneUseCase(sceneRepository);
const getScenesByChapterIdUseCase = new GetScenesByChapterIdUseCase(sceneRepository);
const updateSceneUseCase = new UpdateSceneUseCase(sceneRepository);
const deleteSceneUseCase = new DeleteSceneUseCase(sceneRepository);

const sceneController = new SceneController(
  createSceneUseCase,
  getSceneUseCase,
  getScenesByChapterIdUseCase,
  updateSceneUseCase,
  deleteSceneUseCase
);

sceneRoutes.post('/', (c) => sceneController.createScene(c));
sceneRoutes.get('/:id', (c) => sceneController.getScene(c));
sceneRoutes.get('/chapter/:chapterId', (c) => sceneController.getScenesByChapterId(c));
sceneRoutes.put('/:id', (c) => sceneController.updateScene(c));
sceneRoutes.delete('/:id', (c) => sceneController.deleteScene(c));

export default sceneRoutes;
