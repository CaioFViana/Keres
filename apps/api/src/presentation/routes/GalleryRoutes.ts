import {
  CreateGalleryUseCase,
  DeleteGalleryUseCase,
  GetGalleryByOwnerIdUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryUseCase,
  UpdateGalleryUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { GalleryRepository } from '@infrastructure/persistence/GalleryRepository'
import { GalleryCreateSchema, GalleryUpdateSchema } from '@keres/shared'
import { GalleryController } from '@presentation/controllers/GalleryController'
import { Hono } from 'hono'

console.log('Initializing GalleryRoutes...')

const galleryRoutes = new Hono()

// Dependencies for GalleryController
console.log('Instantiating GalleryRepository...')
const galleryRepository = new GalleryRepository()
console.log('Instantiating CreateGalleryUseCase...')
const createGalleryUseCase = new CreateGalleryUseCase(galleryRepository)
console.log('Instantiating GetGalleryUseCase...')
const getGalleryUseCase = new GetGalleryUseCase(galleryRepository)
console.log('Instantiating UpdateGalleryUseCase...')
const updateGalleryUseCase = new UpdateGalleryUseCase(galleryRepository)
console.log('Instantiating DeleteGalleryUseCase...')
const deleteGalleryUseCase = new DeleteGalleryUseCase(galleryRepository)
console.log('Instantiating GetGalleryByOwnerIdUseCase...')
const getGalleryByOwnerIdUseCase = new GetGalleryByOwnerIdUseCase(galleryRepository)
console.log('Instantiating GetGalleryByStoryIdUseCase...')
const getGalleryByStoryIdUseCase = new GetGalleryByStoryIdUseCase(galleryRepository)

console.log('Instantiating GalleryController...')
const galleryController = new GalleryController(
  createGalleryUseCase,
  getGalleryUseCase,
  updateGalleryUseCase,
  deleteGalleryUseCase,
  getGalleryByOwnerIdUseCase,
  getGalleryByStoryIdUseCase,
)

galleryRoutes.post('/', zValidator('json', GalleryCreateSchema), (c) =>
  galleryController.createGallery(c),
)
galleryRoutes.get('/:id', (c) => galleryController.getGallery(c))
galleryRoutes.get('/owner/:ownerId', (c) => galleryController.getGalleryByOwnerId(c))
galleryRoutes.get('/story/:storyId', (c) => galleryController.getGalleryByStoryId(c))
galleryRoutes.put('/:id', zValidator('json', GalleryUpdateSchema), (c) =>
  galleryController.updateGallery(c),
)
galleryRoutes.delete('/:id', (c) => galleryController.deleteGallery(c))

console.log('GalleryRoutes initialized.')

export default galleryRoutes
