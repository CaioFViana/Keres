import {
  CreateCharacterMomentUseCase,
  DeleteCharacterMomentUseCase,
  GetCharacterMomentsByCharacterIdUseCase,
  GetCharacterMomentsByMomentIdUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { CharacterMomentRepository, CharacterRepository, MomentRepository, SceneRepository, ChapterRepository, StoryRepository } from '@infrastructure/persistence'
import { CharacterMomentCreateSchema, CharacterMomentResponseSchema } from '@keres/shared' // Import CharacterMomentResponseSchema
import { CharacterMomentController } from '@presentation/controllers/CharacterMomentController'
import { z } from 'zod' // Import z for defining parameters

const characterMomentRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for CharacterMomentController
const characterMomentRepository = new CharacterMomentRepository()
const characterRepository = new CharacterRepository()
const momentRepository = new MomentRepository()
const sceneRepository = new SceneRepository()
const chapterRepository = new ChapterRepository()
const storyRepository = new StoryRepository()
const createCharacterMomentUseCase = new CreateCharacterMomentUseCase(
  characterMomentRepository,
  characterRepository,
  momentRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const getCharacterMomentsByCharacterIdUseCase = new GetCharacterMomentsByCharacterIdUseCase(
  characterMomentRepository,
  characterRepository,
  storyRepository,
)
const getCharacterMomentsByMomentIdUseCase = new GetCharacterMomentsByMomentIdUseCase(
  characterMomentRepository,
  momentRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const deleteCharacterMomentUseCase = new DeleteCharacterMomentUseCase(
  characterMomentRepository,
  characterRepository,
  momentRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)

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
    tags: ['Character Moments'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CharacterMomentCreateSchema.parse(body)
    try {
      const characterMoment = await characterMomentController.createCharacterMoment(userId, data)
      return c.json(characterMoment, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
    tags: ['Character Moments'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = CharacterIdParamSchema.parse(c.req.param())
    try {
      const characterMoments = await characterMomentController.getCharacterMomentsByCharacterId(
        userId,
        params.characterId,
      )
      return c.json(characterMoments, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
    tags: ['Character Moments'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = MomentIdParamSchema.parse(c.req.param())
    try {
      const characterMoments = await characterMomentController.getCharacterMomentsByMomentId(
        userId,
        params.momentId,
      )
      return c.json(characterMoments, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Character Moment not found',
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
    tags: ['Character Moments'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CharacterMomentCreateSchema.parse(body)
    try {
      await characterMomentController.deleteCharacterMoment(userId, data.characterId, data.momentId)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default characterMomentRoutes
