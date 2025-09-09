import {
  BulkDeleteCharacterRelationUseCase,
  CreateCharacterRelationUseCase,
  CreateManyCharacterRelationsUseCase,
  DeleteCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
  GetCharacterRelationUseCase,
  UpdateCharacterRelationUseCase,
  UpdateManyCharacterRelationsUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import {
  CharacterRelationRepository,
  CharacterRepository,
  StoryRepository,
} from '@infrastructure/persistence'
import {
  BulkDeleteResponseSchema,
  CharacterRelationCreateSchema,
  CharacterRelationResponseSchema,
  CharacterRelationUpdateSchema,
  ErrorResponseSchema,
} from '@keres/shared' // Import CharacterRelationResponseSchema
import { CharacterRelationController } from '@presentation/controllers/CharacterRelationController'
import { z } from 'zod' // Import z for defining parameters

const characterRelationRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for CharacterRelationController
const characterRelationRepository = new CharacterRelationRepository()
const characterRepository = new CharacterRepository()
const storyRepository = new StoryRepository()
const createCharacterRelationUseCase = new CreateCharacterRelationUseCase(
  characterRelationRepository,
  characterRepository,
  storyRepository,
)
const getCharacterRelationUseCase = new GetCharacterRelationUseCase(
  characterRelationRepository,
  characterRepository,
  storyRepository,
)
const updateCharacterRelationUseCase = new UpdateCharacterRelationUseCase(
  characterRelationRepository,
  characterRepository,
  storyRepository,
)
const deleteCharacterRelationUseCase = new DeleteCharacterRelationUseCase(
  characterRelationRepository,
  characterRepository,
  storyRepository,
)

const bulkDeleteCharacterRelationUseCase = new BulkDeleteCharacterRelationUseCase(
  characterRelationRepository,
  characterRepository,
  storyRepository,
)

const getCharacterRelationsByCharIdUseCase = new GetCharacterRelationsByCharIdUseCase(
  characterRelationRepository,
  characterRepository,
  storyRepository,
)

const createManyCharacterRelationsUseCase = new CreateManyCharacterRelationsUseCase(
  characterRelationRepository,
  characterRepository,
  storyRepository,
)

const updateManyCharacterRelationsUseCase = new UpdateManyCharacterRelationsUseCase(
  characterRelationRepository,
  characterRepository,
  storyRepository,
)

const characterRelationController = new CharacterRelationController(
  createCharacterRelationUseCase,
  getCharacterRelationUseCase,
  updateCharacterRelationUseCase,
  deleteCharacterRelationUseCase,
  bulkDeleteCharacterRelationUseCase,
  getCharacterRelationsByCharIdUseCase,
  createManyCharacterRelationsUseCase,
  updateManyCharacterRelationsUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const CharIdParamSchema = z.object({
  charId: z.ulid(),
})

// Define schema for bulk delete request body // Added
const BulkDeleteSchema = z.object({
  ids: z.array(z.ulid()),
}) // Added

// POST /
characterRelationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new character relation',
    description: 'Creates a new relation between two characters.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CharacterRelationCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Character Relation created successfully',
        content: {
          'application/json': {
            schema: CharacterRelationResponseSchema,
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CharacterRelationCreateSchema.parse(body)
    try {
      const characterRelation = await characterRelationController.createCharacterRelation(
        userId,
        data,
      )
      return c.json(characterRelation, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// Define schema for batch character relation creation
const CreateManyCharacterRelationsSchema = z.array(CharacterRelationCreateSchema)

// POST /batch
characterRelationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/batch',
    summary: 'Create multiple character relations',
    description: 'Creates multiple relations between characters in a single request.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateManyCharacterRelationsSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Character Relations created successfully',
        content: {
          'application/json': {
            schema: z.array(CharacterRelationResponseSchema),
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CreateManyCharacterRelationsSchema.parse(body)
    try {
      const newCharacterRelations = await characterRelationController.createManyCharacterRelations(
        userId,
        data,
      )
      return c.json(newCharacterRelations, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// Define schema for batch character relation update
const UpdateManyCharacterRelationsSchema = z.array(CharacterRelationUpdateSchema)

// PUT /batch
characterRelationRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/batch',
    summary: 'Update multiple character relations',
    description: 'Updates multiple relations between characters in a single request.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: UpdateManyCharacterRelationsSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Character Relations updated successfully',
        content: {
          'application/json': {
            schema: z.array(CharacterRelationResponseSchema),
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
        description: 'Character Relation not found',
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = UpdateManyCharacterRelationsSchema.parse(body)
    try {
      const updatedCharacterRelations =
        await characterRelationController.updateManyCharacterRelations(userId, data)
      return c.json(updatedCharacterRelations, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
characterRelationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a character relation by ID',
    description: 'Retrieves a single character relation by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Character Relation retrieved successfully',
        content: {
          'application/json': {
            schema: CharacterRelationResponseSchema,
          },
        },
      },
      404: {
        description: 'Character Relation not found',
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const characterRelation = await characterRelationController.getCharacterRelation(
        userId,
        params.id,
      )
      return c.json(characterRelation, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /character/:charId
characterRelationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/character/{charId}',
    summary: 'Get character relations by character ID',
    description: 'Retrieves all relations associated with a specific character.',
    request: {
      params: CharIdParamSchema,
    },
    responses: {
      200: {
        description: 'Character Relations retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(CharacterRelationResponseSchema),
          },
        },
      },
      404: {
        description: 'Character not found',
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = CharIdParamSchema.parse(c.req.param())
    try {
      const characterRelations = await characterRelationController.getCharacterRelationsByCharId(
        userId,
        params.charId,
      )
      return c.json(characterRelations, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
characterRelationRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a character relation by ID',
    description: 'Updates an existing character relation by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: CharacterRelationUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Character Relation updated successfully',
        content: {
          'application/json': {
            schema: CharacterRelationResponseSchema,
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
        description: 'Character Relation not found',
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = CharacterRelationUpdateSchema.parse(body)
    try {
      const updatedCharacterRelation = await characterRelationController.updateCharacterRelation(
        userId,
        params.id,
        data,
      )
      return c.json(updatedCharacterRelation, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
characterRelationRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a character relation by ID',
    description: 'Deletes a character relation by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Character Relation deleted successfully (No Content)',
      },
      404: {
        description: 'Character Relation not found',
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await characterRelationController.deleteCharacterRelation(userId, params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// POST /bulk-delete // Added
characterRelationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bulk-delete',
    summary: 'Bulk delete character relations',
    description: 'Deletes multiple character relations by their IDs.',
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
            schema: BulkDeleteResponseSchema,
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const { ids } = BulkDeleteSchema.parse(body)
    try {
      const result = await characterRelationController.bulkDeleteCharacterRelations(userId, ids)
      return c.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default characterRelationRoutes
