import {
  CreateCharacterMomentUseCase,
  DeleteCharacterMomentUseCase,
  GetCharacterMomentsByCharacterIdUseCase,
  GetCharacterMomentsByMomentIdUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { CharacterMomentRepository } from '@infrastructure/persistence/CharacterMomentRepository'
import { CharacterMomentCreateSchema, CharacterMomentResponseSchema } from '@keres/shared' // Import CharacterMomentResponseSchema
import { CharacterMomentController } from '@presentation/controllers/CharacterMomentController'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing CharacterMomentRoutes...')

const characterMomentRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for CharacterMomentController
console.log('Instantiating CharacterMomentRepository...')
const characterMomentRepository = new CharacterMomentRepository()
console.log('Instantiating CreateCharacterMomentUseCase...')
const createCharacterMomentUseCase = new CreateCharacterMomentUseCase(characterMomentRepository)
console.log('Instantiating GetCharacterMomentsByCharacterIdUseCase...')
const getCharacterMomentsByCharacterIdUseCase = new GetCharacterMomentsByCharacterIdUseCase(
  characterMomentRepository,
)
console.log('Instantiating GetCharacterMomentsByMomentIdUseCase...')
const getCharacterMomentsByMomentIdUseCase = new GetCharacterMomentsByMomentIdUseCase(
  characterMomentRepository,
)
console.log('Instantiating DeleteCharacterMomentUseCase...')
const deleteCharacterMomentUseCase = new DeleteCharacterMomentUseCase(characterMomentRepository)

console.log('Instantiating CharacterMomentController...')
const characterMomentController = new CharacterMomentController(
  createCharacterMomentUseCase,
  getCharacterMomentsByCharacterIdUseCase,
  getCharacterMomentsByMomentIdUseCase,
  deleteCharacterMomentUseCase,
)

// Define schemas for path parameters
const CharacterIdParamSchema = z.object({
  characterId: z.ulid(),
})

const MomentIdParamSchema = z.object({
  momentId: z.ulid(),
})

// POST /
characterMomentRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new character moment',
    description: 'Creates a new association between a character and a moment.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CharacterMomentCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Character Moment created successfully',
        content: {
          'application/json': {
            schema: CharacterMomentResponseSchema,
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
    tags: ['Character Moments'],
  }),
  (c) => characterMomentController.createCharacterMoment(c),
)

// GET /character/:characterId
characterMomentRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/character/{characterId}',
    summary: 'Get character moments by character ID',
    description: 'Retrieves all moments associated with a specific character.',
    request: {
      params: CharacterIdParamSchema,
    },
    responses: {
      200: {
        description: 'Character Moments retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(CharacterMomentResponseSchema),
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
    tags: ['Character Moments'],
  }),
  (c) => characterMomentController.getCharacterMomentsByCharacterId(c),
)

// GET /moment/:momentId
characterMomentRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/moment/{momentId}',
    summary: 'Get character moments by moment ID',
    description: 'Retrieves all characters associated with a specific moment.',
    request: {
      params: MomentIdParamSchema,
    },
    responses: {
      200: {
        description: 'Character Moments retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(CharacterMomentResponseSchema),
          },
        },
      },
      404: {
        description: 'Moment not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Character Moments'],
  }),
  (c) => characterMomentController.getCharacterMomentsByMomentId(c),
)

// DELETE /
characterMomentRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/',
    summary: 'Delete a character moment',
    description: 'Deletes an association between a character and a moment.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CharacterMomentCreateSchema, // Schema for deletion criteria
          },
        },
      },
    },
    responses: {
      204: {
        description: 'Character Moment deleted successfully (No Content)',
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
        description: 'Character Moment not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Character Moments'],
  }),
  (c) => characterMomentController.deleteCharacterMoment(c),
)

console.log('CharacterMomentRoutes initialized.')

export default characterMomentRoutes