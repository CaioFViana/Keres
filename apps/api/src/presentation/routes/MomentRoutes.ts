import {
  BulkDeleteMomentUseCase,
  CreateManyMomentsUseCase,
  CreateMomentUseCase,
  DeleteMomentUseCase,
  GetMomentsBySceneIdUseCase,
  GetMomentUseCase,
  UpdateManyMomentsUseCase,
  UpdateMomentUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  ChapterRepository,
  MomentRepository,
  SceneRepository,
  StoryRepository,
} from '@infrastructure/persistence'
import {
  CreateMomentSchema,
  ListQuerySchema,
  MomentResponseSchema,
  UpdateMomentSchema,
} from '@keres/shared'
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
const createManyMomentsUseCase = new CreateManyMomentsUseCase(
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
const updateManyMomentsUseCase = new UpdateManyMomentsUseCase(
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
const bulkDeleteMomentUseCase = new BulkDeleteMomentUseCase(
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
  bulkDeleteMomentUseCase,
  getMomentsBySceneIdUseCase,
  createManyMomentsUseCase,
  updateManyMomentsUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const SceneIdParamSchema = z.object({
  sceneId: z.ulid(),
})

// Define schema for batch moment creation
const CreateManyMomentsSchema = z.array(CreateMomentSchema)

// Define schema for batch moment update
const UpdateManyMomentsSchema = z.array(UpdateMomentSchema)

// Define schema for bulk delete request body
const BulkDeleteSchema = z.object({
  ids: z.array(z.ulid()),
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

// POST /batch
momentRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/batch',
    summary: 'Create multiple moments',
    description: 'Creates multiple moments for a scene in a single request.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateManyMomentsSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Moments created successfully',
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
    const body = await c.req.json()
    const data = CreateManyMomentsSchema.parse(body)
    try {
      const newMoments = await momentController.createManyMoments(userId, data)
      return c.json(newMoments, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /batch
momentRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/batch',
    summary: 'Update multiple moments',
    description: 'Updates multiple moments in a single request.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: UpdateManyMomentsSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Moments updated successfully',
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
    const body = await c.req.json()
    const data = UpdateManyMomentsSchema.parse(body)
    try {
      const updatedMoments = await momentController.updateManyMoments(userId, data)
      return c.json(updatedMoments, 200)
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

// PATCH /:id (Partial Update)
momentRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a moment by ID',
    description:
      'Partially updates an existing moment by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateMomentSchema, // UpdateMomentSchema already has optional fields
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
    const data = UpdateMomentSchema.parse(body) // UpdateMomentSchema already handles optional fields
    try {
      const updatedMoment = await momentController.updateMoment(userId, params.id, data) // Reusing updateMoment for now
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

// POST /bulk-delete
momentRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bulk-delete',
    summary: 'Bulk delete moments',
    description: 'Deletes multiple moments by their IDs.',
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
            schema: z.object({
              successfulIds: z.array(z.string()),
              failedIds: z.array(z.object({ id: z.string(), reason: z.string() })),
            }),
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
    const { ids } = BulkDeleteSchema.parse(body)
    try {
      const result = await momentController.bulkDeleteMoments(userId, ids)
      return c.json(result, 200)
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
      query: ListQuerySchema,
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
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const moments = await momentController.getMomentsBySceneId(userId, params.sceneId, query)
      return c.json(moments, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default momentRoutes
