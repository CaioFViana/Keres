import {
  CreateRelationUseCase,
  DeleteRelationUseCase,
  GetRelationsByCharIdUseCase,
  GetRelationUseCase,
  UpdateRelationUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { RelationRepository } from '@infrastructure/persistence/RelationRepository'
import { RelationCreateSchema, RelationUpdateSchema, RelationResponseSchema } from '@keres/shared' // Import RelationResponseSchema
import { OpenAPIHono, createRoute } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Relations'],
  }),
  zValidator('json', RelationCreateSchema),
  (c) => relationController.createRelation(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Relations'],
  }),
  (c) => relationController.getRelation(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Relations'],
  }),
  (c) => relationController.getRelationsByCharId(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
      404: {
        description: 'Relation not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Relations'],
  }),
  (c) => relationController.updateRelation(c),
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
    },
    responses: {
      204: {
        description: 'Relation deleted successfully (No Content)',
      },
      404: {
        description: 'Relation not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Relations'],
  }),
  (c) => relationController.deleteRelation(c),
)

console.log('RelationRoutes initialized.')

export default relationRoutes