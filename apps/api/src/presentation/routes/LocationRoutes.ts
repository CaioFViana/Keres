import {
  CreateLocationUseCase,
  DeleteLocationUseCase,
  GetLocationsByStoryIdUseCase,
  GetLocationUseCase,
  UpdateLocationUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { LocationRepository } from '@infrastructure/persistence/LocationRepository'
import { LocationCreateSchema, LocationUpdateSchema, LocationResponseSchema } from '@keres/shared' // Import LocationResponseSchema
import { LocationController } from '@presentation/controllers/LocationController'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing LocationRoutes...')

const locationRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for LocationController
console.log('Instantiating LocationRepository...')
const locationRepository = new LocationRepository()
console.log('Instantiating CreateLocationUseCase...')
const createLocationUseCase = new CreateLocationUseCase(locationRepository)
console.log('Instantiating GetLocationUseCase...')
const getLocationUseCase = new GetLocationUseCase(locationRepository)
console.log('Instantiating UpdateLocationUseCase...')
const updateLocationUseCase = new UpdateLocationUseCase(locationRepository)
console.log('Instantiating DeleteLocationUseCase...')
const deleteLocationUseCase = new DeleteLocationUseCase(locationRepository)
console.log('Instantiating GetLocationsByStoryIdUseCase...')
const getLocationsByStoryIdUseCase = new GetLocationsByStoryIdUseCase(locationRepository)

console.log('Instantiating LocationController...')
const locationController = new LocationController(
  createLocationUseCase,
  getLocationUseCase,
  updateLocationUseCase,
  deleteLocationUseCase,
  getLocationsByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.string().ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.string().ulid(),
})

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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Locations'],
  }),
  zValidator('json', LocationCreateSchema),
  (c) => locationController.createLocation(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Locations'],
  }),
  (c) => locationController.getLocation(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Locations'],
  }),
  (c) => locationController.getLocationsByStoryId(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
      404: {
        description: 'Location not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Locations'],
  }),
  zValidator('json', LocationUpdateSchema),
  (c) => locationController.updateLocation(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Locations'],
  }),
  (c) => locationController.deleteLocation(c),
)

console.log('LocationRoutes initialized.')

export default locationRoutes