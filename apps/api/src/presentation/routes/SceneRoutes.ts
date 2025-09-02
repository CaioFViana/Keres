import {
  CreateSceneUseCase,
  DeleteSceneUseCase,
  GetScenesByChapterIdUseCase,
  GetSceneUseCase,
  UpdateSceneUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { ChapterRepository, ChoiceRepository, StoryRepository } from '@infrastructure/persistence'
import { SceneRepository } from '@infrastructure/persistence/SceneRepository'
import { SceneCreateSchema, SceneResponseSchema, SceneUpdateSchema } from '@keres/shared' // Import SceneResponseSchema
import { SceneController } from '@presentation/controllers/SceneController'
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing SceneRoutes...')

const sceneRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for SceneController
const sceneRepository = new SceneRepository()
const choiceRepository = new ChoiceRepository()
const storyRepository = new StoryRepository()
const chapterRepository = new ChapterRepository()

const createSceneUseCase = new CreateSceneUseCase(sceneRepository, choiceRepository, storyRepository, chapterRepository)
const getSceneUseCase = new GetSceneUseCase(sceneRepository)
const updateSceneUseCase = new UpdateSceneUseCase(sceneRepository, choiceRepository, storyRepository, chapterRepository)
const deleteSceneUseCase = new DeleteSceneUseCase(sceneRepository, choiceRepository, storyRepository, chapterRepository)
const getScenesByChapterIdUseCase = new GetScenesByChapterIdUseCase(sceneRepository)

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
    tags: ['Scenes'],
  }),
  async (c) => {
    const body = await c.req.json()
    const data = SceneCreateSchema.parse(body)
    try {
      const scene = await sceneController.createScene(data)
      return c.json(scene, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      const scene = await sceneController.getScene(params.id)
      return c.json(scene, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const params = ChapterIdParamSchema.parse(c.req.param())
    try {
      const scenes = await sceneController.getScenesByChapterId(params.chapterId)
      return c.json(scenes, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Scene not found',
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = SceneUpdateSchema.parse(body)
    try {
      const updatedScene = await sceneController.updateScene(params.id, data)
      return c.json(updatedScene, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
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
      query: ChapterIdParamSchema,
    },
    responses: {
      204: {
        description: 'Scene deleted successfully (No Content)',
      },
      404: {
        description: 'Scene not found',
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const query = ChapterIdParamSchema.parse(c.req.query())
    try {
      await sceneController.deleteScene(params.id, query.chapterId)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

console.log('SceneRoutes initialized.')

export default sceneRoutes
