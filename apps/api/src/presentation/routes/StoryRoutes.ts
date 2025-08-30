import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateStoryUseCase,
  GetStoryUseCase,
  UpdateStoryUseCase,
  DeleteStoryUseCase,
  GetStoriesByUserIdUseCase,
} from '@application/use-cases';
import { StoryRepository } from '@infrastructure/persistence/StoryRepository';
import { StoryController } from '@presentation/controllers/StoryController';
import { StoryCreateSchema, StoryUpdateSchema } from '@keres/shared';

console.log('Initializing StoryRoutes...');

const storyRoutes = new Hono();

// Dependencies for StoryController
console.log('Instantiating StoryRepository...');
const storyRepository = new StoryRepository();
console.log('Instantiating CreateStoryUseCase...');
const createStoryUseCase = new CreateStoryUseCase(storyRepository);
console.log('Instantiating GetStoryUseCase...');
const getStoryUseCase = new GetStoryUseCase(storyRepository);
console.log('Instantiating UpdateStoryUseCase...');
const updateStoryUseCase = new UpdateStoryUseCase(storyRepository);
console.log('Instantiating DeleteStoryUseCase...');
const deleteStoryUseCase = new DeleteStoryUseCase(storyRepository);
console.log('Instantiating GetStoriesByUserIdUseCase...');
const getStoriesByUserIdUseCase = new GetStoriesByUserIdUseCase(storyRepository);

console.log('Instantiating StoryController...');
const storyController = new StoryController(
  createStoryUseCase,
  getStoryUseCase,
  updateStoryUseCase,
  deleteStoryUseCase,
  getStoriesByUserIdUseCase
);

storyRoutes.post('/', zValidator('json', StoryCreateSchema), (c) => storyController.createStory(c));
storyRoutes.get('/:id', (c) => storyController.getStory(c));
storyRoutes.get('/user/:userId', (c) => storyController.getStoriesByUserId(c));
storyRoutes.put('/:id', zValidator('json', StoryUpdateSchema), (c) => storyController.updateStory(c));
storyRoutes.delete('/:id', (c) => storyController.deleteStory(c));

console.log('StoryRoutes initialized.');

export default storyRoutes;