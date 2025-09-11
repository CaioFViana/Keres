import {
  BulkDeleteGalleryUseCase,
  CreateGalleryUseCase,
  DeleteGalleryUseCase,
  GetGalleryByOwnerIdUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryUseCase,
  UpdateGalleryUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  CharacterRepository,
  GalleryRepository,
  LocationRepository,
  NoteRepository,
  StoryRepository,
} from '@infrastructure/persistence'
import { NodeFileSystemService } from '@infrastructure/services'
import {
  BulkDeleteResponseSchema,
  ErrorResponseSchema,
  GalleryCreateSchema,
  GalleryResponseSchema,
  GalleryUpdateSchema,
  ListQuerySchema,
  IdParamSchema,
  OwnerIdParamSchema,
  StoryIdParamSchema,
  BulkDeleteSchema,
  GalleryDeleteQuerySchema,
  PaginatedResponseSchema,
} from '@keres/shared'
import { GalleryController } from '@presentation/controllers/GalleryController'
import { z } from 'zod'

const GalleryCreateApiSchema = GalleryCreateSchema.extend({
  file: z.string()
})

const GalleryUpdateApiSchema = GalleryUpdateSchema.extend({
  file: z.string().optional(),
})

const galleryRoutes = new OpenAPIHono()

// Dependencies for GalleryController
const galleryRepository = new GalleryRepository()
const storyRepository = new StoryRepository()
const characterRepository = new CharacterRepository()
const noteRepository = new NoteRepository()
const locationRepository = new LocationRepository()
const nodefsSystemService = new NodeFileSystemService()

const createGalleryUseCase = new CreateGalleryUseCase(
  galleryRepository,
  storyRepository,
  characterRepository,
  noteRepository,
  locationRepository,
  nodefsSystemService
)
const getGalleryUseCase = new GetGalleryUseCase(galleryRepository, storyRepository)
const updateGalleryUseCase = new UpdateGalleryUseCase(
  galleryRepository,
  storyRepository,
  characterRepository,
  noteRepository,
  locationRepository,
  nodefsSystemService
)
const deleteGalleryUseCase = new DeleteGalleryUseCase(
  galleryRepository,
  storyRepository,
  noteRepository,
)
const bulkDeleteGalleryUseCase = new BulkDeleteGalleryUseCase(
  galleryRepository,
  storyRepository,
  noteRepository,
)
const getGalleryByOwnerIdUseCase = new GetGalleryByOwnerIdUseCase(
  galleryRepository
)
const getGalleryByStoryIdUseCase = new GetGalleryByStoryIdUseCase(
  galleryRepository,
  storyRepository,
)

const galleryController = new GalleryController(
  createGalleryUseCase,
  getGalleryUseCase,
  updateGalleryUseCase,
  deleteGalleryUseCase,
  bulkDeleteGalleryUseCase,
  getGalleryByOwnerIdUseCase,
  getGalleryByStoryIdUseCase,
  galleryRepository,
  storyRepository,
  nodefsSystemService, // Added
)



// POST /
galleryRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new gallery item',
    description: 'Creates a new gallery item for a story or owner.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: GalleryCreateApiSchema,
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
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()

    const parsedBody = GalleryCreateSchema.parse(body)

    try {
      const gallery = await galleryController.createGallery(userId, parsedBody)
      return c.json(gallery, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const gallery = await galleryController.getGallery(userId, params.id)
      return c.json(gallery, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /images/:filename
galleryRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/images/{id}',
    summary: 'Serve a gallery image file',
    description: 'Retrieves a gallery image file by its ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Image file retrieved successfully',
        content: {
          'application/octet-stream': {
            schema: {
              type: 'string',
              format: 'binary',
            },
          },
        },
      },
      404: {
        description: 'Image not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const { fileContent, contentType } = await galleryController.getGalleryImage(
        userId,
        params.id,
      )
      return c.body(new Uint8Array(fileContent), 200, { 'Content-Type': contentType })
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /owner/:ownerId
galleryRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/owner/{ownerId}',
    summary: 'Get gallery items by owner ID',
    description: 'Retrieves all gallery items belonging to a specific owner.',
    request: {
      params: OwnerIdParamSchema,
      query: ListQuerySchema,
    },
    responses: {
      200: {
        description: 'Gallery items retrieved successfully',
        content: {
          'application/json': {
            schema: PaginatedResponseSchema(GalleryResponseSchema),
          },
        },
      },
      404: {
        description: 'Owner not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = OwnerIdParamSchema.parse(c.req.param())
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const galleryItems = await galleryController.getGalleryByOwnerId(
        userId,
        params.ownerId,
        query,
      )
      return c.json(galleryItems, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /story/:storyId
galleryRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get gallery items by story ID',
    description: 'Retrieves all gallery items belonging to a specific story.',
    request: {
      params: StoryIdParamSchema,
      query: ListQuerySchema,
    },
    responses: {
      200: {
        description: 'Gallery items retrieved successfully',
        content: {
          'application/json': {
            schema: PaginatedResponseSchema(GalleryResponseSchema),
          },
        },
      },
      404: {
        description: 'Story not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = StoryIdParamSchema.parse(c.req.param())
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const galleryItems = await galleryController.getGalleryByStoryId(
        userId,
        params.storyId,
        query,
      )
      return c.json(galleryItems, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
            schema: GalleryUpdateApiSchema,
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
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Gallery item not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()

    const parsedBody = GalleryUpdateSchema.parse(body)

    try {
      const updatedGallery = await galleryController.updateGallery(
        userId,
        params.id,
        parsedBody,
      )
      return c.json(updatedGallery, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PATCH /:id (Partial Update)
galleryRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a gallery item by ID',
    description:
      'Partially updates an existing gallery item by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: GalleryUpdateApiSchema, // GalleryUpdateSchema already has optional fields
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
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Gallery item not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = GalleryUpdateSchema.parse(body) // GalleryUpdateSchema already handles optional fields

    try {
      const updatedGallery = await galleryController.updateGallery(
        userId,
        params.id,
        data,
      )
      return c.json(updatedGallery, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
      query: GalleryDeleteQuerySchema,
    },
    responses: {
      204: {
        description: 'Gallery item deleted successfully (No Content)',
      },
      400: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Gallery item not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const query = GalleryDeleteQuerySchema.parse(c.req.query())
    try {
      await galleryController.deleteGallery(userId, params.id, query.storyId, query.ownerId)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// POST /bulk-delete // Added
galleryRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bulk-delete',
    summary: 'Bulk delete gallery items',
    description: 'Deletes multiple gallery items by their IDs.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: BulkDeleteSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Bulk delete operation results',
        content: {
          'application/json': {
            schema: BulkDeleteResponseSchema,
          },
        },
      },
      400: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const { ids } = BulkDeleteSchema.parse(body)
    try {
      const result = await galleryController.bulkDeleteGallery(userId, ids)
      return c.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default galleryRoutes
