import {
  CreateStoryUseCase,
  DeleteStoryUseCase,
  GetStoriesByUserIdUseCase,
  GetStoryUseCase,
  UpdateStoryUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import {
  ChapterRepository,
  CharacterRepository,
  LocationRepository,
  StoryRepository,
} from '@infrastructure/persistence'
import {
  ErrorResponseSchema,
  ListQuerySchema,
  StoryCreateSchema,
  StoryResponseSchema,
  StoryUpdateSchema,
} from '@keres/shared' // Import StoryResponseSchema
import { StoryController } from '@presentation/controllers/StoryController'
import { z } from 'zod' // Import z for defining parameters

const storyRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for StoryController
const storyRepository = new StoryRepository()
const characterRepository = new CharacterRepository()
const chapterRepository = new ChapterRepository()
const locationRepository = new LocationRepository()
const createStoryUseCase = new CreateStoryUseCase(storyRepository)
const getStoryUseCase = new GetStoryUseCase(storyRepository, characterRepository, chapterRepository) // Updated
const updateStoryUseCase = new UpdateStoryUseCase(storyRepository)
const deleteStoryUseCase = new DeleteStoryUseCase(storyRepository)
const getStoriesByUserIdUseCase = new GetStoriesByUserIdUseCase(
  storyRepository,
  characterRepository,
  chapterRepository,
  locationRepository,
)

const storyController = new StoryController(
  createStoryUseCase,
  getStoryUseCase,
  updateStoryUseCase,
  deleteStoryUseCase,
  getStoriesByUserIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

// Define schema for include query parameter
const IncludeQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : [])),
})

// POST /
storyRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new story',
    description: 'Creates a new story.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: StoryCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Story created successfully',
        content: {
          'application/json': {
            schema: StoryResponseSchema,
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
    tags: ['Stories'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = StoryCreateSchema.parse(body)
    try {
      const story = await storyController.createStory(userId, data)
      return c.json(story, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
storyRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a story by ID',
    description: 'Retrieves a single story by its unique ID.',
    request: {
      params: IdParamSchema,
      query: IncludeQuerySchema, // Add this line
    },
    responses: {
      200: {
        description: 'Story retrieved successfully',
        content: {
          'application/json': {
            schema: StoryResponseSchema,
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
    tags: ['Stories'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const query = IncludeQuerySchema.parse(c.req.query()) // Parse query
    try {
      const story = await storyController.getStory(userId, params.id, query.include) // Pass include
      return c.json(story, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /user/:userId
storyRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/all',
    summary: 'Get stories by user ID',
    description: 'Retrieves all stories belonging to a specific user.',
    request: {
      query: ListQuerySchema,
    },
    responses: {
      200: {
        description: 'Stories retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(StoryResponseSchema),
          },
        },
      },
      404: {
        description: 'User not found',
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
    tags: ['Stories'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const stories = await storyController.getStoriesByUserId(userId, query)
      return c.json(stories, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
storyRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a story by ID',
    description: 'Updates an existing story by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: StoryUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Story updated successfully',
        content: {
          'application/json': {
            schema: StoryResponseSchema,
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
    tags: ['Stories'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = StoryUpdateSchema.parse(body)
    try {
      const updatedStory = await storyController.updateStory(userId, params.id, data)
      return c.json(updatedStory, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PATCH /:id (Partial Update)
storyRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a story by ID',
    description:
      'Partially updates an existing story by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: StoryUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Story updated successfully',
        content: {
          'application/json': {
            schema: StoryResponseSchema,
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
    tags: ['Stories'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = StoryUpdateSchema.parse(body) // StoryUpdateSchema already handles optional fields
    try {
      const updatedStory = await storyController.updateStory(userId, params.id, data) // Reusing updateStory for now
      return c.json(updatedStory, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
storyRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a story by ID',
    description: 'Deletes a story by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Story deleted successfully (No Content)',
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
    tags: ['Stories'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await storyController.deleteStory(userId, params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default storyRoutes
