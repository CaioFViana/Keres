import {
  CreateGalleryUseCase,
  DeleteGalleryUseCase,
  GetGalleryByOwnerIdUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryUseCase,
  UpdateGalleryUseCase,
} from '@application/use-cases'
import {
  CreateGalleryUseCase,
  DeleteGalleryUseCase,
  GetGalleryByOwnerIdUseCase,
  GetGalleryByStoryIdUseCase,
  GetGalleryUseCase,
  UpdateGalleryUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { GalleryRepository } from '@infrastructure/persistence/GalleryRepository'
import { GalleryCreateSchema, GalleryResponseSchema, GalleryUpdateSchema } from '@keres/shared' // Import GalleryResponseSchema
import { GalleryController } from '@presentation/controllers/GalleryController'
import { z } from 'zod' // Import z for defining parameters


const galleryRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for GalleryController
const galleryRepository = new GalleryRepository()
const createGalleryUseCase = new CreateGalleryUseCase(galleryRepository)
const getGalleryUseCase = new GetGalleryUseCase(galleryRepository)
const updateGalleryUseCase = new UpdateGalleryUseCase(galleryRepository)
const deleteGalleryUseCase = new DeleteGalleryUseCase(galleryRepository)
const getGalleryByOwnerIdUseCase = new GetGalleryByOwnerIdUseCase(galleryRepository)
const getGalleryByStoryIdUseCase = new GetGalleryByStoryIdUseCase(galleryRepository)


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
    const body = await c.req.json()
    const data = GalleryCreateSchema.parse(body)
    try {
      const gallery = await galleryController.createGallery(data)
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
    const params = IdParamSchema.parse(c.req.param())
    try {
      const gallery = await galleryController.getGallery(params.id)
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
    const params = OwnerIdParamSchema.parse(c.req.param())
    try {
      const galleryItems = await galleryController.getGalleryByOwnerId(params.ownerId)
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
    const params = StoryIdParamSchema.parse(c.req.param())
    try {
      const galleryItems = await galleryController.getGalleryByStoryId(params.storyId)
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
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = GalleryUpdateSchema.parse(body)
    try {
      const updatedGallery = await galleryController.updateGallery(params.id, data)
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
    const params = IdParamSchema.parse(c.req.param())
    const query = z.object({ storyId: z.ulid(), ownerId: z.ulid() }).parse(c.req.query())
    try {
      await galleryController.deleteGallery(params.id, query.storyId, query.ownerId)
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

import { GalleryRepository } from '@infrastructure/persistence/GalleryRepository'
import { GalleryCreateSchema, GalleryResponseSchema, GalleryUpdateSchema } from '@keres/shared' // Import GalleryResponseSchema
import { GalleryController } from '@presentation/controllers/GalleryController'
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
    const body = await c.req.json()
    const data = GalleryCreateSchema.parse(body)
    try {
      const gallery = await galleryController.createGallery(data)
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
    const params = IdParamSchema.parse(c.req.param())
    try {
      const gallery = await galleryController.getGallery(params.id)
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
    const params = OwnerIdParamSchema.parse(c.req.param())
    try {
      const galleryItems = await galleryController.getGalleryByOwnerId(params.ownerId)
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
    const params = StoryIdParamSchema.parse(c.req.param())
    try {
      const galleryItems = await galleryController.getGalleryByStoryId(params.storyId)
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
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = GalleryUpdateSchema.parse(body)
    try {
      const updatedGallery = await galleryController.updateGallery(params.id, data)
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
    const params = IdParamSchema.parse(c.req.param())
    const query = z.object({ storyId: z.ulid(), ownerId: z.ulid() }).parse(c.req.query())
    try {
      await galleryController.deleteGallery(params.id, query.storyId, query.ownerId)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

console.log('GalleryRoutes initialized.')

export default galleryRoutes
