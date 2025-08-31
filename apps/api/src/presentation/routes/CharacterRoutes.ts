import {
  CreateCharacterUseCase,
  DeleteCharacterUseCase,
  GetCharactersByStoryIdUseCase,
  GetCharacterUseCase,
  UpdateCharacterUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { CharacterRepository } from '@infrastructure/persistence/CharacterRepository'
import { CharacterCreateSchema, CharacterUpdateSchema, CharacterResponseSchema } from '@keres/shared' // Import CharacterResponseSchema
import { CharacterController } from '@presentation/controllers/CharacterController'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing CharacterRoutes...')

const characterRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for CharacterController
console.log('Instantiating CharacterRepository...')
const characterRepository = new CharacterRepository()
console.log('Instantiating CreateCharacterUseCase...')
const createCharacterUseCase = new CreateCharacterUseCase(characterRepository)
console.log('Instantiating GetCharacterUseCase...')
const getCharacterUseCase = new GetCharacterUseCase(characterRepository)
console.log('Instantiating UpdateCharacterUseCase...')
const updateCharacterUseCase = new UpdateCharacterUseCase(characterRepository)
console.log('Instantiating DeleteCharacterUseCase...')
const deleteCharacterUseCase = new DeleteCharacterUseCase(characterRepository)
console.log('Instantiating GetCharactersByStoryIdUseCase...')
const getCharactersByStoryIdUseCase = new GetCharactersByStoryIdUseCase(characterRepository)

console.log('Instantiating CharacterController...')
const characterController = new CharacterController(
  createCharacterUseCase,
  getCharacterUseCase,
  updateCharacterUseCase,
  deleteCharacterUseCase,
  getCharactersByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.string().ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.string().ulid(),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Characters'],
  }),
  zValidator('json', CharacterCreateSchema),
  (c) => characterController.createCharacter(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Characters'],
  }),
  (c) => characterController.getCharacter(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Characters'],
  }),
  (c) => characterController.getCharactersByStoryId(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
      404: {
        description: 'Character not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Characters'],
  }),
  zValidator('json', CharacterUpdateSchema),
  (c) => characterController.updateCharacter(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Characters'],
  }),
  (c) => characterController.deleteCharacter(c),
)

console.log('CharacterRoutes initialized.')

export default characterRoutes