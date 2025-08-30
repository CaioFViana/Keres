import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  CreateLocationUseCase,
  GetLocationUseCase,
  UpdateLocationUseCase,
  DeleteLocationUseCase,
  GetLocationsByStoryIdUseCase,
} from '@application/use-cases';
import { LocationRepository } from '@infrastructure/persistence/LocationRepository';
import { LocationController } from '@presentation/controllers/LocationController';
import { LocationCreateSchema, LocationUpdateSchema } from '@keres/shared';

console.log('Initializing LocationRoutes...');

const locationRoutes = new Hono();

// Dependencies for LocationController
console.log('Instantiating LocationRepository...');
const locationRepository = new LocationRepository();
console.log('Instantiating CreateLocationUseCase...');
const createLocationUseCase = new CreateLocationUseCase(locationRepository);
console.log('Instantiating GetLocationUseCase...');
const getLocationUseCase = new GetLocationUseCase(locationRepository);
console.log('Instantiating UpdateLocationUseCase...');
const updateLocationUseCase = new UpdateLocationUseCase(locationRepository);
console.log('Instantiating DeleteLocationUseCase...');
const deleteLocationUseCase = new DeleteLocationUseCase(locationRepository);
console.log('Instantiating GetLocationsByStoryIdUseCase...');
const getLocationsByStoryIdUseCase = new GetLocationsByStoryIdUseCase(locationRepository);

console.log('Instantiating LocationController...');
const locationController = new LocationController(
  createLocationUseCase,
  getLocationUseCase,
  updateLocationUseCase,
  deleteLocationUseCase,
  getLocationsByStoryIdUseCase
);

locationRoutes.post('/', zValidator('json', LocationCreateSchema), (c) => locationController.createLocation(c));
locationRoutes.get('/:id', (c) => locationController.getLocation(c));
locationRoutes.get('/story/:storyId', (c) => locationController.getLocationsByStoryId(c));
locationRoutes.put('/:id', zValidator('json', LocationUpdateSchema), (c) => locationController.updateLocation(c));
locationRoutes.delete('/:id', (c) => locationController.deleteLocation(c));

console.log('LocationRoutes initialized.');

export default locationRoutes;