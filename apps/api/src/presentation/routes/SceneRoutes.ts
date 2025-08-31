import {
  CreateSceneUseCase,
  DeleteSceneUseCase,
  GetScenesByChapterIdUseCase,
  GetSceneUseCase,
  UpdateSceneUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { SceneRepository } from '@infrastructure/persistence/SceneRepository'
import { SceneCreateSchema, SceneUpdateSchema, SceneResponseSchema } from '@keres/shared' // Import SceneResponseSchema
import { SceneController } from '@presentation/controllers/SceneController'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing SceneRoutes...')

const sceneRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for SceneController
console.log('Instantiating SceneRepository...')
const sceneRepository = new SceneRepository()
console.log('Instantiating CreateSceneUseCase...')
const createSceneUseCase = new CreateSceneUseCase(sceneRepository)
console.log('Instantiating GetSceneUseCase...')
const getSceneUseCase = new GetSceneUseCase(sceneRepository)
console.log('Instantiating UpdateSceneUseCase...')
const updateSceneUseCase = new UpdateSceneUseCase(sceneRepository)
console.log('Instantiating DeleteSceneUseCase...')
const deleteSceneUseCase = new DeleteSceneUseCase(sceneRepository)
console.log('Instantiating GetScenesByChapterIdUseCase...')
const getScenesByChapterIdUseCase = new GetScenesByChapterIdUseCase(sceneRepository)

console.log('Instantiating SceneController...')
const sceneController = new SceneController(
  createSceneUseCase,
  getSceneUseCase,
  updateSceneUseCase,
  deleteSceneUseCase,
  getScenesByChapterIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const ChapterIdParamSchema = z.object({
  chapterId: z.ulid(),
})

// POST /
sceneRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new scene',
    description: 'Creates a new scene within a chapter.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: SceneCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Scene created successfully',
        content: {
          'application/json': {
            schema: SceneResponseSchema,
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
    tags: ['Scenes'],
  }),
  zValidator('json', SceneCreateSchema),
  (c) => sceneController.createScene(c),
)

// GET /:id
sceneRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a scene by ID',
    description: 'Retrieves a single scene by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Scene retrieved successfully',
        content: {
          'application/json': {
            schema: SceneResponseSchema,
          },
        },
      },
      404: {
        description: 'Scene not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Scenes'],
  }),
  (c) => sceneController.getScene(c),
)

// GET /chapter/:chapterId
sceneRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/chapter/{chapterId}',
    summary: 'Get scenes by chapter ID',
    description: 'Retrieves all scenes belonging to a specific chapter.',
    request: {
      params: ChapterIdParamSchema,
    },
    responses: {
      200: {
        description: 'Scenes retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SceneResponseSchema),
          },
        },
      },
      404: {
        description: 'Chapter not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Scenes'],
  }),
  (c) => sceneController.getScenesByChapterId(c),
)

// PUT /:id
sceneRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a scene by ID',
    description: 'Updates an existing scene by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: SceneUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Scene updated successfully',
        content: {
          'application/json': {
            schema: SceneResponseSchema,
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
        description: 'Scene not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Scenes'],
  }),
  (c) => sceneController.updateScene(c),
)

// DELETE /:id
sceneRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a scene by ID',
    description: 'Deletes a scene by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Scene deleted successfully (No Content)',
      },
      404: {
        description: 'Scene not found',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Scenes'],
  }),
  (c) => sceneController.deleteScene(c),
)

console.log('SceneRoutes initialized.')

export default sceneRoutes