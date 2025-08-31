import {
  CreateStoryUseCase,
  DeleteStoryUseCase,
  GetStoriesByUserIdUseCase,
  GetStoryUseCase,
  UpdateStoryUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { zValidator } from '@hono/zod-validator'
import { StoryRepository } from '@infrastructure/persistence/StoryRepository'
import { StoryCreateSchema, StoryResponseSchema, StoryUpdateSchema } from '@keres/shared' // Import StoryResponseSchema
import { StoryController } from '@presentation/controllers/StoryController'
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing StoryRoutes...')

const storyRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for StoryController
console.log('Instantiating StoryRepository...')
const storyRepository = new StoryRepository()
console.log('Instantiating CreateStoryUseCase...')
const createStoryUseCase = new CreateStoryUseCase(storyRepository)
console.log('Instantiating GetStoryUseCase...')
const getStoryUseCase = new GetStoryUseCase(storyRepository)
console.log('Instantiating UpdateStoryUseCase...')
const updateStoryUseCase = new UpdateStoryUseCase(storyRepository)
console.log('Instantiating DeleteStoryUseCase...')
const deleteStoryUseCase = new DeleteStoryUseCase(storyRepository)
console.log('Instantiating GetStoriesByUserIdUseCase...')
const getStoriesByUserIdUseCase = new GetStoriesByUserIdUseCase(storyRepository)

console.log('Instantiating StoryController...')
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

const UserIdParamSchema = z.object({
  userId: z.ulid(),
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
    tags: ['Stories'],
  }),
  async (c) => await storyController.createStory(c),
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
    tags: ['Stories'],
  }),
  async (c) => await storyController.getStory(c),
)

// GET /user/:userId
storyRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/user/{userId}',
    summary: 'Get stories by user ID',
    description: 'Retrieves all stories belonging to a specific user.',
    request: {
      params: UserIdParamSchema,
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
    tags: ['Stories'],
  }),
  async (c) => await storyController.getStoriesByUserId(c),
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Story not found',
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
    tags: ['Stories'],
  }),
  async (c) => await storyController.updateStory(c),
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
    tags: ['Stories'],
  }),
  async (c) => await storyController.deleteStory(c),
)

console.log('StoryRoutes initialized.')

export default storyRoutes
