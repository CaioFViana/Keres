import {
  BulkDeleteCharacterUseCase,
  CreateCharacterUseCase,
  CreateManyCharactersUseCase,
  DeleteCharacterUseCase,
  GetCharactersByStoryIdUseCase,
  GetCharacterUseCase,
  UpdateCharacterUseCase,
  UpdateManyCharactersUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import {
  CharacterMomentRepository,
  CharacterRelationRepository,
  CharacterRepository,
  MomentRepository,
  StoryRepository,
} from '@infrastructure/persistence'
import {
  CharacterCreateSchema,
  CharacterResponseSchema,
  CharacterUpdateSchema,
  ListQuerySchema,
  UpdateManyCharactersSchema,
} from '@keres/shared' // Import CharacterResponseSchema
import { CharacterController } from '@presentation/controllers/CharacterController'
import { z } from 'zod' // Import z for defining parameters

const characterRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for CharacterController
const characterRepository = new CharacterRepository()
const storyRepository = new StoryRepository()
const characterMomentRepository = new CharacterMomentRepository() // New
const characterRelationRepository = new CharacterRelationRepository() // New
const momentRepository = new MomentRepository() // New
const createCharacterUseCase = new CreateCharacterUseCase(characterRepository, storyRepository)
const createManyCharactersUseCase = new CreateManyCharactersUseCase(
  characterRepository,
  storyRepository,
)
const updateManyCharactersUseCase = new UpdateManyCharactersUseCase(
  characterRepository,
  storyRepository,
)

const getCharacterUseCase = new GetCharacterUseCase(
  characterRepository,
  storyRepository,
  characterMomentRepository,
  characterRelationRepository,
  momentRepository,
) // Updated
const updateCharacterUseCase = new UpdateCharacterUseCase(characterRepository, storyRepository)
const deleteCharacterUseCase = new DeleteCharacterUseCase(characterRepository, storyRepository)
const bulkDeleteCharacterUseCase = new BulkDeleteCharacterUseCase(
  characterRepository,
  storyRepository,
)
const getCharactersByStoryIdUseCase = new GetCharactersByStoryIdUseCase(
  characterRepository,
  storyRepository,
)

const characterController = new CharacterController(
  createCharacterUseCase,
  getCharacterUseCase,
  updateCharacterUseCase,
  deleteCharacterUseCase,
  bulkDeleteCharacterUseCase,
  getCharactersByStoryIdUseCase,
  createManyCharactersUseCase,
  updateManyCharactersUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
})

// Define schema for include query parameter
const IncludeQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : [])),
})

// Define schema for batch character creation
const CreateManyCharactersSchema = z.array(CharacterCreateSchema)

// Define schema for bulk delete request body
const BulkDeleteSchema = z.object({
  ids: z.array(z.ulid()),
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

// POST /batch
characterRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/batch',
    summary: 'Create multiple characters',
    description: 'Creates multiple characters in a story in a single request.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateManyCharactersSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Characters created successfully',
        content: {
          'application/json': {
            schema: z.array(CharacterResponseSchema),
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
    const data = CreateManyCharactersSchema.parse(body)
    try {
      const newCharacters = await characterController.createManyCharacters(userId, data)
      return c.json(newCharacters, 201)
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
      query: IncludeQuerySchema, // Add this line
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
    const query = IncludeQuerySchema.parse(c.req.query()) // Parse query
    try {
      const character = await characterController.getCharacter(userId, params.id, query.include) // Pass include
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
      query: ListQuerySchema,
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
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const characters = await characterController.getCharactersByStoryId(
        userId,
        params.storyId,
        query,
      )
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

// PATCH /:id (Partial Update)
characterRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a character by ID',
    description:
      'Partially updates an existing character by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: CharacterUpdateSchema, // CharacterUpdateSchema already has optional fields
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
    const data = CharacterUpdateSchema.parse(body) // CharacterUpdateSchema already handles optional fields
    try {
      const updatedCharacter = await characterController.updateCharacter(userId, params.id, data) // Reusing updateCharacter for now
      return c.json(updatedCharacter, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /batch
characterRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/batch',
    summary: 'Update multiple characters',
    description: 'Updates multiple characters in a single request.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: UpdateManyCharactersSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Characters updated successfully',
        content: {
          'application/json': {
            schema: z.array(CharacterResponseSchema),
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
    const body = await c.req.json()
    const data = UpdateManyCharactersSchema.parse(body)
    try {
      const updatedCharacters = await characterController.updateManyCharacters(userId, data)
      return c.json(updatedCharacters, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
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

// POST /bulk-delete
characterRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bulk-delete',
    summary: 'Bulk delete characters',
    description: 'Deletes multiple characters by their IDs.',
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
    tags: ['Characters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const { ids } = BulkDeleteSchema.parse(body)
    try {
      const result = await characterController.bulkDeleteCharacters(userId, ids)
      return c.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default characterRoutes
