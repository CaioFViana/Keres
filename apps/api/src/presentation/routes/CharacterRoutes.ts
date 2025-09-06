import {
  CreateCharacterUseCase,
  DeleteCharacterUseCase,
  GetCharactersByStoryIdUseCase,
  GetCharacterUseCase,
  UpdateCharacterUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { CharacterRepository, StoryRepository } from '@infrastructure/persistence'
import {
  CharacterCreateSchema,
  CharacterResponseSchema,
  CharacterUpdateSchema,
} from '@keres/shared' // Import CharacterResponseSchema
import { CharacterController } from '@presentation/controllers/CharacterController'
import { z } from 'zod' // Import z for defining parameters

const characterRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for CharacterController
const characterRepository = new CharacterRepository()
const storyRepository = new StoryRepository()
const createCharacterUseCase = new CreateCharacterUseCase(characterRepository, storyRepository)
const getCharacterUseCase = new GetCharacterUseCase(characterRepository, storyRepository)
const updateCharacterUseCase = new UpdateCharacterUseCase(characterRepository, storyRepository)
const deleteCharacterUseCase = new DeleteCharacterUseCase(characterRepository, storyRepository)
const getCharactersByStoryIdUseCase = new GetCharactersByStoryIdUseCase(
  characterRepository,
  storyRepository,
)

const characterController = new CharacterController(
  createCharacterUseCase,
  getCharacterUseCase,
  updateCharacterUseCase,
  deleteCharacterUseCase,
  getCharactersByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
})

// POST /
characterRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new character',
    description: 'Creates a new character in a story.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CharacterCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Character created successfully',
        content: {
          'application/json': {
            schema: CharacterResponseSchema,
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
    tags: ['Characters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CharacterCreateSchema.parse(body)
    try {
      const character = await characterController.createCharacter(userId, data)
      return c.json(character, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
characterRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a character by ID',
    description: 'Retrieves a single character by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Character retrieved successfully',
        content: {
          'application/json': {
            schema: CharacterResponseSchema,
          },
        },
      },
      404: {
        description: 'Character not found',
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
    tags: ['Characters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const character = await characterController.getCharacter(userId, params.id)
      return c.json(character, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /story/:storyId
characterRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get characters by story ID',
    description: 'Retrieves all characters belonging to a specific story.',
    request: {
      params: StoryIdParamSchema,
    },
    responses: {
      200: {
        description: 'Characters retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(CharacterResponseSchema),
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
    tags: ['Characters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = StoryIdParamSchema.parse(c.req.param())
    try {
      const characters = await characterController.getCharactersByStoryId(userId, params.storyId)
      return c.json(characters, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
characterRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a character by ID',
    description: 'Updates an existing character by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: CharacterUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Character updated successfully',
        content: {
          'application/json': {
            schema: CharacterResponseSchema,
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
        description: 'Character not found',
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
    tags: ['Characters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = CharacterUpdateSchema.parse(body)
    try {
      const updatedCharacter = await characterController.updateCharacter(userId, params.id, data)
      return c.json(updatedCharacter, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
characterRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a character by ID',
    description: 'Deletes a character by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Character deleted successfully (No Content)',
      },
      404: {
        description: 'Character not found',
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
    tags: ['Characters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await characterController.deleteCharacter(userId, params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default characterRoutes
