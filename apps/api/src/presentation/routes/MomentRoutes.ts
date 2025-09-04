import {
  CreateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
  GetMomentUseCase,
  UpdateMomentUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { MomentRepository, SceneRepository, ChapterRepository, StoryRepository } from '@infrastructure/persistence'
import { CreateMomentSchema, MomentResponseSchema, UpdateMomentSchema } from '@keres/shared'
import { MomentController } from '@presentation/controllers/MomentController'
import { z } from 'zod'

export const momentRoutes = new OpenAPIHono()

// Dependencies for MomentController
const momentRepository = new MomentRepository()
const sceneRepository = new SceneRepository()
const chapterRepository = new ChapterRepository()
const storyRepository = new StoryRepository()
const createMomentUseCase = new CreateMomentUseCase(
  momentRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const getMomentUseCase = new GetMomentUseCase(
  momentRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const updateMomentUseCase = new UpdateMomentUseCase(
  momentRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const deleteMomentUseCase = new DeleteMomentUseCase(
  momentRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const getMomentsBySceneIdUseCase = new GetMomentsBySceneIdUseCase(
  momentRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)

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
    description: 'Creates a new moment for a scene.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateMomentSchema,
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CreateMomentSchema.parse(body)
    try {
      const newMoment = await momentController.createMoment(userId, data)
      return c.json(newMoment, 201)
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const moment = await momentController.getMoment(userId, params.id)
      if (!moment) {
        return c.json({ error: 'Moment not found' }, 404)
      }
      return c.json(moment, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
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
            schema: UpdateMomentSchema,
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateMomentSchema.parse(body)
    try {
      const updatedMoment = await momentController.updateMoment(userId, params.id, data)
      if (!updatedMoment) {
        return c.json({ error: 'Moment not found' }, 404)
      }
      return c.json(updatedMoment, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
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
    },
    responses: {
      204: {
        description: 'Moment deleted successfully',
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
        // Added 404 response
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await momentController.deleteMoment(userId, params.id) // Just call the method
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /by-scene/{sceneId}
momentRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/by-scene/{sceneId}',
    summary: 'Get moments by scene ID',
    description: 'Retrieves all moments associated with a specific scene.',
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = SceneIdParamSchema.parse(c.req.param())
    try {
      const moments = await momentController.getMomentsBySceneId(userId, params.sceneId)
      return c.json(moments, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)
