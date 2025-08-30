import { Hono } from 'hono';
import { StoryController } from '@presentation/controllers/StoryController';
import {
  CreateStoryUseCase,
  GetStoryUseCase,
  GetStoriesByUserIdUseCase,
  UpdateStoryUseCase,
  DeleteStoryUseCase,
} from '@application/use-cases';
import { StoryRepository } from '@infrastructure/persistence/StoryRepository';

const storyRoutes = new Hono();

// Dependencies for StoryController
const storyRepository = new StoryRepository();
const createStoryUseCase = new CreateStoryUseCase(storyRepository);
const getStoryUseCase = new GetStoryUseCase(storyRepository);
const getStoriesByUserIdUseCase = new GetStoriesByUserIdUseCase(storyRepository);
const updateStoryUseCase = new UpdateStoryUseCase(storyRepository);
const deleteStoryUseCase = new DeleteStoryUseCase(storyRepository);

const storyController = new StoryController(
  createStoryUseCase,
  getStoryUseCase,
  getStoriesByUserIdUseCase,
  updateStoryUseCase,
  deleteStoryUseCase
);

storyRoutes.post('/', (c) => storyController.createStory(c));
storyRoutes.get('/:id', (c) => storyController.getStory(c));
storyRoutes.get('/user/:userId', (c) => storyController.getStoriesByUserId(c));
storyRoutes.put('/:id', (c) => storyController.updateStory(c));
storyRoutes.delete('/:id', (c) => storyController.deleteStory(c));

export default storyRoutes;
