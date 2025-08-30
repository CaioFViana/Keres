import { Hono } from 'hono';
import { LocationController } from '@presentation/controllers/LocationController';
import {
  CreateLocationUseCase,
  GetLocationUseCase,
  GetLocationsByStoryIdUseCase,
  UpdateLocationUseCase,
  DeleteLocationUseCase,
} from '@application/use-cases';
import { LocationRepository } from '@infrastructure/persistence/LocationRepository';

const locationRoutes = new Hono();

// Dependencies for LocationController
const locationRepository = new LocationRepository();
const createLocationUseCase = new CreateLocationUseCase(locationRepository);
const getLocationUseCase = new GetLocationUseCase(locationRepository);
const getLocationsByStoryIdUseCase = new GetLocationsByStoryIdUseCase(locationRepository);
const updateLocationUseCase = new UpdateLocationUseCase(locationRepository);
const deleteLocationUseCase = new DeleteLocationUseCase(locationRepository);

const locationController = new LocationController(
  createLocationUseCase,
  getLocationUseCase,
  getLocationsByStoryIdUseCase,
  updateLocationUseCase,
  deleteLocationUseCase
);

locationRoutes.post('/', (c) => locationController.createLocation(c));
locationRoutes.get('/:id', (c) => locationController.getLocation(c));
locationRoutes.get('/story/:storyId', (c) => locationController.getLocationsByStoryId(c));
locationRoutes.put('/:id', (c) => locationController.updateLocation(c));
locationRoutes.delete('/:id', (c) => locationController.deleteLocation(c));

export default locationRoutes;
