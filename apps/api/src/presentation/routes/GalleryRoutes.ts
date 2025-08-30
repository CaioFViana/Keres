import { Hono } from 'hono';
import { GalleryController } from '@presentation/controllers/GalleryController';
import {
  CreateGalleryUseCase,
  GetGalleryUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryByOwnerIdUseCase,
  UpdateGalleryUseCase,
  DeleteGalleryUseCase,
} from '@application/use-cases';
import { GalleryRepository } from '@infrastructure/persistence/GalleryRepository';

const galleryRoutes = new Hono();

// Dependencies for GalleryController
const galleryRepository = new GalleryRepository();
const createGalleryUseCase = new CreateGalleryUseCase(galleryRepository);
const getGalleryUseCase = new GetGalleryUseCase(galleryRepository);
const getGalleryByStoryIdUseCase = new GetGalleryByStoryIdUseCase(galleryRepository);
const getGalleryByOwnerIdUseCase = new GetGalleryByOwnerIdUseCase(galleryRepository);
const updateGalleryUseCase = new UpdateGalleryUseCase(galleryRepository);
const deleteGalleryUseCase = new DeleteGalleryUseCase(galleryRepository);

const galleryController = new GalleryController(
  createGalleryUseCase,
  getGalleryUseCase,
  getGalleryByStoryIdUseCase,
  getGalleryByOwnerIdUseCase,
  updateGalleryUseCase,
  deleteGalleryUseCase
);

galleryRoutes.post('/', (c) => galleryController.createGallery(c));
galleryRoutes.get('/:id', (c) => galleryController.getGallery(c));
galleryRoutes.get('/story/:storyId', (c) => galleryController.getGalleryByStoryId(c));
galleryRoutes.get('/owner/:ownerId', (c) => galleryController.getGalleryByOwnerId(c));
galleryRoutes.put('/:id', (c) => galleryController.updateGallery(c));
galleryRoutes.delete('/:id', (c) => galleryController.deleteGallery(c));

export default galleryRoutes;
