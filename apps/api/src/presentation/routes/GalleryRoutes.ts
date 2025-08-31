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
import { GalleryCreateSchema, GalleryUpdateSchema, GalleryResponseSchema } from '@keres/shared' // Import GalleryResponseSchema
import { GalleryController } from '@presentation/controllers/GalleryController'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing GalleryRoutes...')

const galleryRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

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

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.string().ulid(),
})

const OwnerIdParamSchema = z.object({
  ownerId: z.string().ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.string().ulid(),
})

// POST /
galleryRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new gallery item',
    description: 'Creates a new gallery item (image) associated with a story and an owner.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: GalleryCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Gallery item created successfully',
        content: {
          'application/json': {
            schema: GalleryResponseSchema,
          },
        },
      },
      400: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  (c) => galleryController.createGallery(c),
)

// GET /:id
galleryRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a gallery item by ID',
    description: 'Retrieves a single gallery item by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Gallery item retrieved successfully',
        content: {
          'application/json': {
            schema: GalleryResponseSchema,
          },
        },
      },
      404: {
        description: 'Gallery item not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  (c) => galleryController.getGallery(c),
)

// GET /owner/:ownerId
galleryRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/owner/{ownerId}',
    summary: 'Get gallery items by owner ID',
    description: 'Retrieves all gallery items associated with a specific owner (e.g., character, location).',
    request: {
      params: OwnerIdParamSchema,
    },
    responses: {
      200: {
        description: 'Gallery items retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(GalleryResponseSchema),
          },
        },
      },
      404: {
        description: 'Owner not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  (c) => galleryController.getGalleryByOwnerId(c),
)

// GET /story/:storyId
galleryRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get gallery items by story ID',
    description: 'Retrieves all gallery items associated with a specific story.',
    request: {
      params: StoryIdParamSchema,
    },
    responses: {
      200: {
        description: 'Gallery items retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(GalleryResponseSchema),
          },
        },
      },
      404: {
        description: 'Story not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  (c) => galleryController.getGalleryByStoryId(c),
)

// PUT /:id
galleryRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a gallery item by ID',
    description: 'Updates an existing gallery item by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: GalleryUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Gallery item updated successfully',
        content: {
          'application/json': {
            schema: GalleryResponseSchema,
          },
        },
      },
      400: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
      404: {
        description: 'Gallery item not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  (c) => galleryController.updateGallery(c),
)

// DELETE /:id
galleryRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a gallery item by ID',
    description: 'Deletes a gallery item by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Gallery item deleted successfully (No Content)',
      },
      404: {
        description: 'Gallery item not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  (c) => galleryController.deleteGallery(c),
)

console.log('GalleryRoutes initialized.')

export default galleryRoutes