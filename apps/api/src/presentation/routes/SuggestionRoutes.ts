import {
  CreateSuggestionUseCase,
  DeleteSuggestionUseCase,
  GetSuggestionsByStoryAndTypeUseCase,
  GetSuggestionsByStoryIdUseCase,
  GetSuggestionsByTypeUseCase,
  GetSuggestionsByUserAndTypeUseCase,
  GetSuggestionsByUserIdUseCase,
  GetSuggestionUseCase,
  UpdateSuggestionUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { SuggestionRepository } from '@infrastructure/persistence/SuggestionRepository'
import {
  CreateSuggestionSchema,
  SuggestionResponseSchema,
  UpdateSuggestionSchema,
} from '@keres/shared'
import { SuggestionController } from '@presentation/controllers/SuggestionController'
import { z } from 'zod'

const suggestionRoutes = new OpenAPIHono()

// Dependencies for SuggestionController
const suggestionRepository = new SuggestionRepository()
const createSuggestionUseCase = new CreateSuggestionUseCase(suggestionRepository)
const getSuggestionUseCase = new GetSuggestionUseCase(suggestionRepository)
const updateSuggestionUseCase = new UpdateSuggestionUseCase(suggestionRepository)
const deleteSuggestionUseCase = new DeleteSuggestionUseCase(suggestionRepository)
const getSuggestionsByUserIdUseCase = new GetSuggestionsByUserIdUseCase(suggestionRepository)
const getSuggestionsByStoryIdUseCase = new GetSuggestionsByStoryIdUseCase(suggestionRepository)
const getSuggestionsByTypeUseCase = new GetSuggestionsByTypeUseCase(suggestionRepository)
const getSuggestionsByUserAndTypeUseCase = new GetSuggestionsByUserAndTypeUseCase(
  suggestionRepository,
)
const getSuggestionsByStoryAndTypeUseCase = new GetSuggestionsByStoryAndTypeUseCase(
  suggestionRepository,
)

const suggestionController = new SuggestionController(
  createSuggestionUseCase,
  getSuggestionUseCase,
  updateSuggestionUseCase,
  deleteSuggestionUseCase,
  getSuggestionsByUserIdUseCase,
  getSuggestionsByStoryIdUseCase,
  getSuggestionsByTypeUseCase,
  getSuggestionsByUserAndTypeUseCase,
  getSuggestionsByStoryAndTypeUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const UserIdParamSchema = z.object({
  userId: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
})

const TypeParamSchema = z.object({
  type: z.string(),
})

// POST /
suggestionRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new suggestion',
    description: 'Creates a new customizable list suggestion.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateSuggestionSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Suggestion created successfully',
        content: {
          'application/json': {
            schema: SuggestionResponseSchema,
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CreateSuggestionSchema.parse(body)
    try {
      const newSuggestion = await suggestionController.createSuggestion(userId, data)
      return c.json(newSuggestion, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a suggestion by ID',
    description: 'Retrieves a single suggestion by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Suggestion retrieved successfully',
        content: {
          'application/json': {
            schema: SuggestionResponseSchema,
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
        description: 'Suggestion not found',
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const suggestion = await suggestionController.getSuggestion(userId, params.id)
      if (!suggestion) {
        return c.json({ error: 'Suggestion not found' }, 404)
      }
      return c.json(suggestion, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /user/:userId
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/user/{userId}',
    summary: 'Get suggestions by user ID',
    description: 'Retrieves all suggestions associated with a specific user.',
    request: {
      params: UserIdParamSchema,
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = UserIdParamSchema.parse(c.req.param())
    try {
      const suggestions = await suggestionController.getSuggestionsByUserId(userId)
      return c.json(suggestions, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /story/:storyId
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get suggestions by story ID',
    description: 'Retrieves all suggestions associated with a specific story.',
    request: {
      params: StoryIdParamSchema,
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = StoryIdParamSchema.parse(c.req.param())
    try {
      const suggestions = await suggestionController.getSuggestionsByStoryId(userId, params.storyId)
      return c.json(suggestions, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /type/:type
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/type/{type}',
    summary: 'Get suggestions by type',
    description:
      'Retrieves all suggestions of a specific type (e.g., "genre", "character_gender").',
    request: {
      params: TypeParamSchema,
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = TypeParamSchema.parse(c.req.param())
    try {
      const suggestions = await suggestionController.getSuggestionsByType(userId, params.type)
      return c.json(suggestions, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /user/:userId/type/:type
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/user/{userId}/type/{type}',
    summary: 'Get suggestions by user ID and type',
    description: 'Retrieves all suggestions associated with a specific user and type.',
    request: {
      params: z.object({
        userId: z.ulid(),
        type: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = z.object({ userId: z.ulid(), type: z.string() }).parse(c.req.param())
    try {
      const suggestions = await suggestionController.getSuggestionsByUserAndType(
        userId,
        params.type,
      )
      return c.json(suggestions, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /story/:storyId/type/:type
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}/type/{type}',
    summary: 'Get suggestions by story ID and type',
    description: 'Retrieves all suggestions associated with a specific story and type.',
    request: {
      params: z.object({
        storyId: z.ulid(),
        type: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = z.object({ storyId: z.ulid(), type: z.string() }).parse(c.req.param())
    try {
      const suggestions = await suggestionController.getSuggestionsByStoryAndType(
        userId,
        params.storyId,
        params.type,
      )
      return c.json(suggestions, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
suggestionRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a suggestion by ID',
    description: 'Updates an existing suggestion by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateSuggestionSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Suggestion updated successfully',
        content: {
          'application/json': {
            schema: SuggestionResponseSchema,
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
        description: 'Suggestion not found',
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateSuggestionSchema.parse(body)
    try {
      const updatedSuggestion = await suggestionController.updateSuggestion(userId, params.id, data)
      if (!updatedSuggestion) {
        return c.json({ error: 'Suggestion not found' }, 404)
      }
      return c.json(updatedSuggestion, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
suggestionRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a suggestion by ID',
    description: 'Deletes a suggestion by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Suggestion deleted successfully (No Content)',
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
        description: 'Suggestion not found',
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await suggestionController.deleteSuggestion(userId, params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default suggestionRoutes
