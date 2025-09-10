import {
  BulkDeleteLocationUseCase,
  CreateLocationUseCase,
  DeleteLocationUseCase,
  GetLocationsByStoryIdUseCase,
  GetLocationUseCase,
  UpdateLocationUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { LocationRepository, SceneRepository, StoryRepository } from '@infrastructure/persistence'
import {
  BulkDeleteResponseSchema,
  ErrorResponseSchema,
  ListQuerySchema,
  LocationCreateSchema,
  LocationResponseSchema,
  LocationUpdateSchema,
} from '@keres/shared' // Import LocationResponseSchema
import { LocationController } from '@presentation/controllers/LocationController'
import { z } from 'zod' // Import z for defining parameters

const locationRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for LocationController
const locationRepository = new LocationRepository()
const storyRepository = new StoryRepository()
const sceneRepository = new SceneRepository()
const createLocationUseCase = new CreateLocationUseCase(locationRepository, storyRepository)
const getLocationUseCase = new GetLocationUseCase(
  locationRepository,
  storyRepository,
  sceneRepository,
)
const updateLocationUseCase = new UpdateLocationUseCase(locationRepository, storyRepository)
const deleteLocationUseCase = new DeleteLocationUseCase(
  locationRepository,
  storyRepository,
  sceneRepository,
)
const bulkDeleteLocationUseCase = new BulkDeleteLocationUseCase(
  locationRepository,
  storyRepository,
  sceneRepository,
)
const getLocationsByStoryIdUseCase = new GetLocationsByStoryIdUseCase(
  locationRepository,
  storyRepository,
)

const locationController = new LocationController(
  createLocationUseCase,
  getLocationUseCase,
  updateLocationUseCase,
  deleteLocationUseCase,
  bulkDeleteLocationUseCase,
  getLocationsByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
})

// Define schema for include query parameter
const IncludeQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : [])),
})

// Define schema for bulk delete request body // Added
const BulkDeleteSchema = z.object({
  ids: z.array(z.ulid()),
}) // Added

// POST /
locationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new location',
    description: 'Creates a new location in a story.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: LocationCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Location created successfully',
        content: {
          'application/json': {
            schema: LocationResponseSchema,
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
    tags: ['Locations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = LocationCreateSchema.parse(body)
    try {
      const location = await locationController.createLocation(userId, data)
      return c.json(location, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
locationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a location by ID',
    description: 'Retrieves a single location by its unique ID.',
    request: {
      params: IdParamSchema,
      query: IncludeQuerySchema, // Add this line
    },
    responses: {
      200: {
        description: 'Location retrieved successfully',
        content: {
          'application/json': {
            schema: LocationResponseSchema,
          },
        },
      },
      404: {
        description: 'Location not found',
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
    tags: ['Locations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const query = IncludeQuerySchema.parse(c.req.query()) // Parse query
    try {
      const location = await locationController.getLocation(userId, params.id, query.include) // Pass include
      return c.json(location, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /story/:storyId
locationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get locations by story ID',
    description: 'Retrieves all locations belonging to a specific story.',
    request: {
      params: StoryIdParamSchema,
      query: ListQuerySchema,
    },
    responses: {
      200: {
        description: 'Locations retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(LocationResponseSchema),
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
    tags: ['Locations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = StoryIdParamSchema.parse(c.req.param())
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const locations = await locationController.getLocationsByStoryId(
        userId,
        params.storyId,
        query,
      )
      return c.json(locations, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
locationRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a location by ID',
    description: 'Updates an existing location by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: LocationUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Location updated successfully',
        content: {
          'application/json': {
            schema: LocationResponseSchema,
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
        description: 'Location not found',
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
    tags: ['Locations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    // Explicitly remove 'id' from the body before parsing
    const { id, ...restOfBody } = body
    const data = LocationUpdateSchema.parse(restOfBody)
    try {
      const updatedLocation = await locationController.updateLocation(userId, params.id, data)
      return c.json(updatedLocation, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PATCH /:id (Partial Update)
locationRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a location by ID',
    description:
      'Partially updates an existing location by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: LocationUpdateSchema, // LocationUpdateSchema already has optional fields
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Location updated successfully',
        content: {
          'application/json': {
            schema: LocationResponseSchema,
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
        description: 'Location not found',
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
    tags: ['Locations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    // Explicitly remove 'id' from the body before parsing
    const { id, ...restOfBody } = body
    const data = LocationUpdateSchema.parse(restOfBody) // LocationUpdateSchema already handles optional fields
    try {
      const updatedLocation = await locationController.updateLocation(userId, params.id, data) // Reusing updateLocation for now
      return c.json(updatedLocation, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
locationRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a location by ID',
    description: 'Deletes a location by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Location deleted successfully (No Content)',
      },
      404: {
        description: 'Location not found',
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
    tags: ['Locations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await locationController.deleteLocation(userId, params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// POST /bulk-delete
locationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bulk-delete',
    summary: 'Bulk delete locations',
    description: 'Deletes multiple locations by their IDs.',
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
    tags: ['Locations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const { ids } = BulkDeleteSchema.parse(body)
    try {
      const result = await locationController.bulkDeleteLocations(userId, ids)
      return c.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default locationRoutes
