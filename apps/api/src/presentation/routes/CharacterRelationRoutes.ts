import {
  CreateCharacterRelationUseCase,
  DeleteCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
  GetCharacterRelationUseCase,
  UpdateCharacterRelationUseCase,
} from '@application/use-cases'
import {
  CreateCharacterRelationUseCase,
  DeleteCharacterRelationUseCase,
  GetCharacterRelationsByCharIdUseCase,
  GetCharacterRelationUseCase,
  UpdateCharacterRelationUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { CharacterRelationRepository } from '@infrastructure/persistence/CharacterRelationRepository'
import {
  CharacterRelationCreateSchema,
  CharacterRelationResponseSchema,
  CharacterRelationUpdateSchema,
} from '@keres/shared' // Import CharacterRelationResponseSchema
import { CharacterRelationController } from '@presentation/controllers/CharacterRelationController'
import { z } from 'zod' // Import z for defining parameters


const characterRelationRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for CharacterRelationController
const characterRelationRepository = new CharacterRelationRepository()
const createCharacterRelationUseCase = new CreateCharacterRelationUseCase(
  characterRelationRepository,
)
const getCharacterRelationUseCase = new GetCharacterRelationUseCase(characterRelationRepository)
const updateCharacterRelationUseCase = new UpdateCharacterRelationUseCase(
  characterRelationRepository,
)
const deleteCharacterRelationUseCase = new DeleteCharacterRelationUseCase(
  characterRelationRepository,
)
const getCharacterRelationsByCharIdUseCase = new GetCharacterRelationsByCharIdUseCase(
  characterRelationRepository,
)


const characterRelationController = new CharacterRelationController(
  createCharacterRelationUseCase,
  getCharacterRelationUseCase,
  updateCharacterRelationUseCase,
  deleteCharacterRelationUseCase,
  getCharacterRelationsByCharIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const CharIdParamSchema = z.object({
  charId: z.ulid(),
})

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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const body = await c.req.json()
    const data = CharacterRelationCreateSchema.parse(body)
    try {
      const characterRelation = await characterRelationController.createCharacterRelation(data)
      return c.json(characterRelation, 201)
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      const characterRelation = await characterRelationController.getCharacterRelation(params.id)
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const params = CharIdParamSchema.parse(c.req.param())
    try {
      const characterRelations = await characterRelationController.getCharacterRelationsByCharId(
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Character Relation not found',
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = CharacterRelationUpdateSchema.parse(body)
    try {
      const updatedCharacterRelation = await characterRelationController.updateCharacterRelation(
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      await characterRelationController.deleteCharacterRelation(params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)


export default characterRelationRoutes

import { CharacterRelationRepository } from '@infrastructure/persistence/CharacterRelationRepository'
import {
  CharacterRelationCreateSchema,
  CharacterRelationResponseSchema,
  CharacterRelationUpdateSchema,
} from '@keres/shared' // Import CharacterRelationResponseSchema
import { CharacterRelationController } from '@presentation/controllers/CharacterRelationController'
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing CharacterRelationRoutes...')

const characterRelationRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for CharacterRelationController
console.log('Instantiating CharacterRelationRepository...')
const characterRelationRepository = new CharacterRelationRepository()
console.log('Instantiating CreateCharacterRelationUseCase...')
const createCharacterRelationUseCase = new CreateCharacterRelationUseCase(
  characterRelationRepository,
)
console.log('Instantiating GetCharacterRelationUseCase...')
const getCharacterRelationUseCase = new GetCharacterRelationUseCase(characterRelationRepository)
console.log('Instantiating UpdateCharacterRelationUseCase...')
const updateCharacterRelationUseCase = new UpdateCharacterRelationUseCase(
  characterRelationRepository,
)
console.log('Instantiating DeleteCharacterRelationUseCase...')
const deleteCharacterRelationUseCase = new DeleteCharacterRelationUseCase(
  characterRelationRepository,
)
console.log('Instantiating GetCharacterRelationsByCharIdUseCase...')
const getCharacterRelationsByCharIdUseCase = new GetCharacterRelationsByCharIdUseCase(
  characterRelationRepository,
)

console.log('Instantiating CharacterRelationController...')
const characterRelationController = new CharacterRelationController(
  createCharacterRelationUseCase,
  getCharacterRelationUseCase,
  updateCharacterRelationUseCase,
  deleteCharacterRelationUseCase,
  getCharacterRelationsByCharIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const CharIdParamSchema = z.object({
  charId: z.ulid(),
})

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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const body = await c.req.json()
    const data = CharacterRelationCreateSchema.parse(body)
    try {
      const characterRelation = await characterRelationController.createCharacterRelation(data)
      return c.json(characterRelation, 201)
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      const characterRelation = await characterRelationController.getCharacterRelation(params.id)
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const params = CharIdParamSchema.parse(c.req.param())
    try {
      const characterRelations = await characterRelationController.getCharacterRelationsByCharId(
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Character Relation not found',
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = CharacterRelationUpdateSchema.parse(body)
    try {
      const updatedCharacterRelation = await characterRelationController.updateCharacterRelation(
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
    tags: ['Character Relations'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      await characterRelationController.deleteCharacterRelation(params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

console.log('CharacterRelationRoutes initialized.')

export default characterRelationRoutes
