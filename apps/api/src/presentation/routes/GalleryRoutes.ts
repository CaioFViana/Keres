import {
  CreateGalleryUseCase,
  DeleteGalleryUseCase,
  GetGalleryByOwnerIdUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryUseCase,
  UpdateGalleryUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import {
  CharacterRepository,
  GalleryRepository,
  LocationRepository,
  NoteRepository,
  StoryRepository,
} from '@infrastructure/persistence'
import {
  GalleryCreateSchema,
  GalleryResponseSchema,
  GalleryUpdateSchema,
  ListQuerySchema,
} from '@keres/shared' // Import GalleryResponseSchema
import { GalleryController } from '@presentation/controllers/GalleryController'
import { z } from 'zod' // Import z for defining parameters

const galleryRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for GalleryController
const galleryRepository = new GalleryRepository()
const storyRepository = new StoryRepository()
const characterRepository = new CharacterRepository()
const noteRepository = new NoteRepository()
const locationRepository = new LocationRepository()

const createGalleryUseCase = new CreateGalleryUseCase(
  galleryRepository,
  storyRepository,
  characterRepository,
  noteRepository,
  locationRepository,
)
const getGalleryUseCase = new GetGalleryUseCase(galleryRepository, storyRepository)
const updateGalleryUseCase = new UpdateGalleryUseCase(
  galleryRepository,
  storyRepository,
  characterRepository,
  noteRepository,
  locationRepository,
)
const deleteGalleryUseCase = new DeleteGalleryUseCase(galleryRepository, storyRepository)
const getGalleryByOwnerIdUseCase = new GetGalleryByOwnerIdUseCase(
  galleryRepository,
  characterRepository,
  noteRepository,
  locationRepository,
  storyRepository,
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
  getGalleryByOwnerIdUseCase,
  getGalleryByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const OwnerIdParamSchema = z.object({
  ownerId: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = GalleryCreateSchema.parse(body)
    try {
      const gallery = await galleryController.createGallery(userId, data)
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
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

// GET /owner/:ownerId
galleryRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/owner/{ownerId}',
    summary: 'Get gallery items by owner ID',
    description:
      'Retrieves all gallery items associated with a specific owner (e.g., character, location).',
    request: {
      params: OwnerIdParamSchema,
      query: ListQuerySchema,
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
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
    description: 'Retrieves all gallery items associated with a specific story.',
    request: {
      params: StoryIdParamSchema,
      query: ListQuerySchema,
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Gallery item not found',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
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
    const data = GalleryUpdateSchema.parse(body)
    try {
      const updatedGallery = await galleryController.updateGallery(userId, params.id, data)
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
      query: z.object({ storyId: z.ulid(), ownerId: z.ulid() }),
    },
    responses: {
      204: {
        description: 'Gallery item deleted successfully (No Content)',
      },
      404: {
        description: 'Gallery item not found',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
    },
    tags: ['Gallery'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const query = z.object({ storyId: z.ulid(), ownerId: z.ulid() }).parse(c.req.query())
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

export default galleryRoutes
