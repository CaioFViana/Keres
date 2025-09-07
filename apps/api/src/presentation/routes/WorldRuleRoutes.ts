import {
  CreateWorldRuleUseCase,
  DeleteWorldRuleUseCase,
  GetWorldRulesByStoryIdUseCase,
  GetWorldRuleUseCase,
  UpdateWorldRuleUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { StoryRepository, WorldRuleRepository } from '@infrastructure/persistence'
import {
  CreateWorldRuleSchema,
  ListQuerySchema,
  UpdateWorldRuleSchema,
  WorldRuleResponseSchema,
} from '@keres/shared'
import { WorldRuleController } from '@presentation/controllers/WorldRuleController'
import { z } from 'zod'

const worldRuleRoutes = new OpenAPIHono()

// Dependencies for WorldRuleController
const worldRuleRepository = new WorldRuleRepository()
const storyRepository = new StoryRepository()
const createWorldRuleUseCase = new CreateWorldRuleUseCase(worldRuleRepository, storyRepository)
const getWorldRuleUseCase = new GetWorldRuleUseCase(worldRuleRepository, storyRepository)
const updateWorldRuleUseCase = new UpdateWorldRuleUseCase(worldRuleRepository, storyRepository)
const deleteWorldRuleUseCase = new DeleteWorldRuleUseCase(worldRuleRepository, storyRepository)
const getWorldRulesByStoryIdUseCase = new GetWorldRulesByStoryIdUseCase(
  worldRuleRepository,
  storyRepository,
)

const worldRuleController = new WorldRuleController(
  createWorldRuleUseCase,
  getWorldRuleUseCase,
  updateWorldRuleUseCase,
  deleteWorldRuleUseCase,
  getWorldRulesByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
})

// POST /
worldRuleRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new world rule',
    description: 'Creates a new world rule for a story.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateWorldRuleSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'World Rule created successfully',
        content: {
          'application/json': {
            schema: WorldRuleResponseSchema,
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
    tags: ['World Rules'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CreateWorldRuleSchema.parse(body)
    try {
      const newWorldRule = await worldRuleController.createWorldRule(userId, data)
      return c.json(newWorldRule, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
worldRuleRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a world rule by ID',
    description: 'Retrieves a single world rule by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'World Rule retrieved successfully',
        content: {
          'application/json': {
            schema: WorldRuleResponseSchema,
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
        description: 'World Rule not found',
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
    tags: ['World Rules'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const worldRule = await worldRuleController.getWorldRule(userId, params.id)
      if (!worldRule) {
        return c.json({ error: 'World Rule not found' }, 404)
      }
      return c.json(worldRule, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /story/:storyId
worldRuleRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get world rules by story ID',
    description: 'Retrieves all world rules associated with a specific story.',
    request: {
      params: StoryIdParamSchema,
      query: ListQuerySchema,
    },
    responses: {
      200: {
        description: 'World Rules retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(WorldRuleResponseSchema),
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
    tags: ['World Rules'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = StoryIdParamSchema.parse(c.req.param())
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const worldRules = await worldRuleController.getWorldRulesByStoryId(
        userId,
        params.storyId,
        query,
      )
      return c.json(worldRules, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
worldRuleRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a world rule by ID',
    description: 'Updates an existing world rule by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateWorldRuleSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'World Rule updated successfully',
        content: {
          'application/json': {
            schema: WorldRuleResponseSchema,
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
        description: 'World Rule not found',
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
    tags: ['World Rules'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateWorldRuleSchema.parse(body)
    try {
      const updatedWorldRule = await worldRuleController.updateWorldRule(userId, params.id, data)
      if (!updatedWorldRule) {
        return c.json({ error: 'World Rule not found' }, 404)
      }
      return c.json(updatedWorldRule, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PATCH /:id (Partial Update)
worldRuleRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a world rule by ID',
    description:
      'Partially updates an existing world rule by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateWorldRuleSchema, // UpdateWorldRuleSchema already has optional fields
          },
        },
      },
    },
    responses: {
      200: {
        description: 'World Rule updated successfully',
        content: {
          'application/json': {
            schema: WorldRuleResponseSchema,
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
        description: 'World Rule not found',
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
    tags: ['World Rules'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateWorldRuleSchema.parse(body) // UpdateWorldRuleSchema already handles optional fields
    try {
      const updatedWorldRule = await worldRuleController.updateWorldRule(userId, params.id, data) // Reusing updateWorldRule for now
      if (!updatedWorldRule) {
        return c.json({ error: 'World Rule not found' }, 404)
      }
      return c.json(updatedWorldRule, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
worldRuleRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a world rule by ID',
    description: 'Deletes a world rule by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'World Rule deleted successfully (No Content)',
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
        description: 'World Rule not found',
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
    tags: ['World Rules'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await worldRuleController.deleteWorldRule(userId, params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default worldRuleRoutes
