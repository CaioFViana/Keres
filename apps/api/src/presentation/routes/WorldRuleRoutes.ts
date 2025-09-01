import {
  CreateWorldRuleUseCase,
  DeleteWorldRuleUseCase,
  GetWorldRulesByStoryIdUseCase,
  GetWorldRuleUseCase,
  UpdateWorldRuleUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { WorldRuleRepository } from '@infrastructure/persistence/WorldRuleRepository'
import {
  CreateWorldRuleSchema,
  UpdateWorldRuleSchema,
  WorldRuleResponseSchema,
} from '@keres/shared'
import { WorldRuleController } from '@presentation/controllers/WorldRuleController'
import { z } from 'zod'

console.log('Initializing WorldRuleRoutes...')

const worldRuleRoutes = new OpenAPIHono()

// Dependencies for WorldRuleController
console.log('Instantiating WorldRuleRepository...')
const worldRuleRepository = new WorldRuleRepository()
console.log('Instantiating CreateWorldRuleUseCase...')
const createWorldRuleUseCase = new CreateWorldRuleUseCase(worldRuleRepository)
console.log('Instantiating GetWorldRuleUseCase...')
const getWorldRuleUseCase = new GetWorldRuleUseCase(worldRuleRepository)
console.log('Instantiating UpdateWorldRuleUseCase...')
const updateWorldRuleUseCase = new UpdateWorldRuleUseCase(worldRuleRepository)
console.log('Instantiating DeleteWorldRuleUseCase...')
const deleteWorldRuleUseCase = new DeleteWorldRuleUseCase(worldRuleRepository)
console.log('Instantiating GetWorldRulesByStoryIdUseCase...')
const getWorldRulesByStoryIdUseCase = new GetWorldRulesByStoryIdUseCase(worldRuleRepository)

console.log('Instantiating WorldRuleController...')
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
    const body = await c.req.json()
    const data = CreateWorldRuleSchema.parse(body)
    try {
      const newWorldRule = await worldRuleController.createWorldRule(data)
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
    const params = IdParamSchema.parse(c.req.param())
    try {
      const worldRule = await worldRuleController.getWorldRule(params.id)
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
    const params = StoryIdParamSchema.parse(c.req.param())
    try {
      const worldRules = await worldRuleController.getWorldRulesByStoryId(params.storyId)
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
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateWorldRuleSchema.parse(body)
    try {
      const updatedWorldRule = await worldRuleController.updateWorldRule(params.id, data)
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
    const params = IdParamSchema.parse(c.req.param())
    try {
      await worldRuleController.deleteWorldRule(params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

console.log('WorldRuleRoutes initialized.')

export default worldRuleRoutes
