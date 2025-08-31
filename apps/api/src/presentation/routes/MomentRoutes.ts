import {
  CreateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
  GetMomentUseCase,
  UpdateMomentUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { MomentRepository } from '@infrastructure/persistence/MomentRepository'
import { MomentCreateSchema, MomentUpdateSchema, MomentResponseSchema } from '@keres/shared' // Import MomentResponseSchema
import { MomentController } from '@presentation/controllers/MomentController'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing MomentRoutes...')

const momentRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for MomentController
console.log('Instantiating MomentRepository...')
const momentRepository = new MomentRepository()
console.log('Instantiating CreateMomentUseCase...')
const createMomentUseCase = new CreateMomentUseCase(momentRepository)
console.log('Instantiating GetMomentUseCase...')
const getMomentUseCase = new GetMomentUseCase(momentRepository)
console.log('Instantiating UpdateMomentUseCase...')
const updateMomentUseCase = new UpdateMomentUseCase(momentRepository)
console.log('Instantiating DeleteMomentUseCase...')
const deleteMomentUseCase = new DeleteMomentUseCase(momentRepository)
console.log('Instantiating GetMomentsBySceneIdUseCase...')
const getMomentsBySceneIdUseCase = new GetMomentsBySceneIdUseCase(momentRepository)

console.log('Instantiating MomentController...')
const momentController = new MomentController(
  createMomentUseCase,
  getMomentUseCase,
  updateMomentUseCase,
  deleteMomentUseCase,
  getMomentsBySceneIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const SceneIdParamSchema = z.object({
  sceneId: z.ulid(),
})

// POST /
momentRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new moment',
    description: 'Creates a new moment within a scene.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: MomentCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Moment created successfully',
        content: {
          'application/json': {
            schema: MomentResponseSchema,
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
    tags: ['Moments'],
  }),
  (c) => momentController.createMoment(c),
)

// GET /:id
momentRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a moment by ID',
    description: 'Retrieves a single moment by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Moment retrieved successfully',
        content: {
          'application/json': {
            schema: MomentResponseSchema,
          },
        },
      },
      404: {
        description: 'Moment not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Moments'],
  }),
  (c) => momentController.getMoment(c),
)

// GET /scene/:sceneId
momentRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/scene/{sceneId}',
    summary: 'Get moments by scene ID',
    description: 'Retrieves all moments belonging to a specific scene.',
    request: {
      params: SceneIdParamSchema,
    },
    responses: {
      200: {
        description: 'Moments retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(MomentResponseSchema),
          },
        },
      },
      404: {
        description: 'Scene not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Moments'],
  }),
  (c) => momentController.getMomentsBySceneId(c),
)

// PUT /:id
momentRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a moment by ID',
    description: 'Updates an existing moment by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: MomentUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Moment updated successfully',
        content: {
          'application/json': {
            schema: MomentResponseSchema,
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
        description: 'Moment not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Moments'],
  }),
  (c) => momentController.updateMoment(c),
)

// DELETE /:id
momentRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a moment by ID',
    description: 'Deletes a moment by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Moment deleted successfully (No Content)',
      },
      404: {
        description: 'Moment not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Moments'],
  }),
  (c) => momentController.deleteMoment(c),
)

console.log('MomentRoutes initialized.')

export default momentRoutes