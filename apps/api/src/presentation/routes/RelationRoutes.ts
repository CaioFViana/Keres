import {
  CreateRelationUseCase,
  DeleteRelationUseCase,
  GetRelationsByCharIdUseCase,
  GetRelationUseCase,
  UpdateRelationUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { RelationRepository } from '@infrastructure/persistence/RelationRepository'
import { RelationCreateSchema, RelationResponseSchema, RelationUpdateSchema } from '@keres/shared' // Import RelationResponseSchema
import { RelationController } from '@presentation/controllers/RelationController'
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing RelationRoutes...')

const relationRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for RelationController
console.log('Instantiating RelationRepository...')
const relationRepository = new RelationRepository()
console.log('Instantiating CreateRelationUseCase...')
const createRelationUseCase = new CreateRelationUseCase(relationRepository)
console.log('Instantiating GetRelationUseCase...')
const getRelationUseCase = new GetRelationUseCase(relationRepository)
console.log('Instantiating UpdateRelationUseCase...')
const updateRelationUseCase = new UpdateRelationUseCase(relationRepository)
console.log('Instantiating DeleteRelationUseCase...')
const deleteRelationUseCase = new DeleteRelationUseCase(relationRepository)
console.log('Instantiating GetRelationsByCharIdUseCase...')
const getRelationsByCharIdUseCase = new GetRelationsByCharIdUseCase(relationRepository)

console.log('Instantiating RelationController...')
const relationController = new RelationController(
  createRelationUseCase,
  getRelationUseCase,
  updateRelationUseCase,
  deleteRelationUseCase,
  getRelationsByCharIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const CharIdParamSchema = z.object({
  charId: z.ulid(),
})

// POST /
relationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new relation',
    description: 'Creates a new relation.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: RelationCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Relation created successfully',
        content: {
          'application/json': {
            schema: RelationResponseSchema,
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
    tags: ['Relations'],
  }),
  async (c) => {
    const body = await c.req.json()
    const data = RelationCreateSchema.parse(body)
    try {
      const relation = await relationController.createRelation(data)
      return c.json(relation, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
relationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a relation by ID',
    description: 'Retrieves a single relation by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Relation retrieved successfully',
        content: {
          'application/json': {
            schema: RelationResponseSchema,
          },
        },
      },
      404: {
        description: 'Relation not found',
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
    tags: ['Relations'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      const relation = await relationController.getRelation(params.id)
      return c.json(relation, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /character/:charId
relationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/character/{charId}',
    summary: 'Get relations by character ID',
    description: 'Retrieves all relations associated with a specific character.',
    request: {
      params: CharIdParamSchema,
    },
    responses: {
      200: {
        description: 'Relations retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(RelationResponseSchema),
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
    tags: ['Relations'],
  }),
  async (c) => {
    const params = CharIdParamSchema.parse(c.req.param())
    try {
      const relations = await relationController.getRelationsByCharId(params.charId)
      return c.json(relations, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
relationRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a relation by ID',
    description: 'Updates an existing relation by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: RelationUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Relation updated successfully',
        content: {
          'application/json': {
            schema: RelationResponseSchema,
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
        description: 'Relation not found',
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
    tags: ['Relations'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = RelationUpdateSchema.parse(body)
    try {
      const updatedRelation = await relationController.updateRelation(params.id, data)
      return c.json(updatedRelation, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
relationRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a relation by ID',
    description: 'Deletes a relation by its unique ID.',
    request: {
      params: IdParamSchema,
      query: z.object({ charIdSource: z.ulid(), charIdTarget: z.ulid() }),
    },
    responses: {
      204: {
        description: 'Relation deleted successfully (No Content)',
      },
      404: {
        description: 'Relation not found',
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
    tags: ['Relations'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const query = z.object({ charIdSource: z.ulid(), charIdTarget: z.ulid() }).parse(c.req.query())
    try {
      await relationController.deleteRelation(params.id, query.charIdSource, query.charIdTarget)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

console.log('RelationRoutes initialized.')

export default relationRoutes
