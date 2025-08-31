import {
  CreateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
  GetMomentUseCase,
  UpdateMomentUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { MomentRepository } from '@infrastructure/persistence/MomentRepository'
import { MomentCreateSchema, MomentResponseSchema, MomentUpdateSchema } from '@keres/shared' // Import MomentResponseSchema
import { MomentController } from '@presentation/controllers/MomentController'
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
    tags: ['Moments'],
  }),
  async (c) => {
    const body = await c.req.json()
    const data = MomentCreateSchema.parse(body)
    try {
      const moment = await momentController.createMoment(data)
      return c.json(moment, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
    tags: ['Moments'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      const moment = await momentController.getMoment(params.id)
      return c.json(moment, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
    tags: ['Moments'],
  }),
  async (c) => {
    const params = SceneIdParamSchema.parse(c.req.param())
    try {
      const moments = await momentController.getMomentsBySceneId(params.sceneId)
      return c.json(moments, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Moment not found',
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
    tags: ['Moments'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = MomentUpdateSchema.parse(body)
    try {
      const updatedMoment = await momentController.updateMoment(params.id, data)
      return c.json(updatedMoment, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
      query: SceneIdParamSchema,
    },
    responses: {
      204: {
        description: 'Moment deleted successfully (No Content)',
      },
      404: {
        description: 'Moment not found',
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
    tags: ['Moments'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const query = SceneIdParamSchema.parse(c.req.query())
    try {
      await momentController.deleteMoment(params.id, query.sceneId)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

console.log('MomentRoutes initialized.')

export default momentRoutes
