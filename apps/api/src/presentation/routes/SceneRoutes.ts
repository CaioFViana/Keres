import {
  BulkDeleteSceneUseCase,
  CreateSceneUseCase,
  DeleteSceneUseCase,
  GetScenesByChapterIdUseCase,
  GetScenesByLocationIdUseCase,
  GetSceneUseCase,
  UpdateSceneUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import {
  ChapterRepository,
  ChoiceRepository,
  LocationRepository,
  MomentRepository,
  SceneRepository,
  StoryRepository,
} from '@infrastructure/persistence'
import {
  BulkDeleteResponseSchema,
  ErrorResponseSchema,
  ListQuerySchema,
  SceneCreateSchema,
  SceneResponseSchema,
  SceneUpdateSchema,
  IdParamSchema,
  ChapterIdParamSchema,
  IncludeQuerySchema,
  BulkDeleteSchema,
  LocationIdParamSchema,
  PaginatedResponseSchema,
} from '@keres/shared' // Import SceneResponseSchema
import { SceneController } from '@presentation/controllers/SceneController'

const sceneRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for SceneController
const sceneRepository = new SceneRepository()
const choiceRepository = new ChoiceRepository()
const storyRepository = new StoryRepository()
const chapterRepository = new ChapterRepository()
const locationRepository = new LocationRepository()
const momentRepository = new MomentRepository()

const createSceneUseCase = new CreateSceneUseCase(
  sceneRepository,
  choiceRepository,
  storyRepository,
  chapterRepository,
  locationRepository,
)
const getSceneUseCase = new GetSceneUseCase(
  sceneRepository,
  chapterRepository,
  storyRepository,
  momentRepository,
  choiceRepository,
)
const updateSceneUseCase = new UpdateSceneUseCase(
  sceneRepository,
  choiceRepository,
  storyRepository,
  chapterRepository,
)
const deleteSceneUseCase = new DeleteSceneUseCase(
  sceneRepository,
  choiceRepository,
  storyRepository,
  chapterRepository,
)
const bulkDeleteSceneUseCase = new BulkDeleteSceneUseCase(
  sceneRepository,
  storyRepository,
  chapterRepository,
  choiceRepository,
)
const getScenesByChapterIdUseCase = new GetScenesByChapterIdUseCase(
  sceneRepository,
  chapterRepository,
  storyRepository,
)

const getScenesByLocationidUseCase = new GetScenesByLocationIdUseCase(
  sceneRepository,
  locationRepository,
  storyRepository,
)

const sceneController = new SceneController(
  createSceneUseCase,
  getSceneUseCase,
  updateSceneUseCase,
  deleteSceneUseCase,
  bulkDeleteSceneUseCase,
  getScenesByChapterIdUseCase,
  getScenesByLocationidUseCase,
)



// GET /location/:locationId
sceneRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/location/{locationId}',
    summary: 'Get scenes by location ID',
    description: 'Retrieves all scenes belonging to a specific location.',
    request: {
      params: LocationIdParamSchema,
      query: ListQuerySchema,
    },
    responses: {
      200: {
        description: 'Scenes retrieved successfully',
        content: {
          'application/json': {
            schema: PaginatedResponseSchema(SceneResponseSchema),
          },
        },
      },
      404: {
        description: 'Location not found',
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = LocationIdParamSchema.parse(c.req.param())
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const scenes = await sceneController.getScenesByLocationId(userId, params.locationId, query)
      return c.json(scenes, 200)
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
      query: ListQuerySchema,
    },
    responses: {
      200: {
        description: 'Scenes retrieved successfully',
        content: {
          'application/json': {
            schema: PaginatedResponseSchema(SceneResponseSchema),
          },
        },
      },
      404: {
        description: 'Chapter not found',
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = ChapterIdParamSchema.parse(c.req.param())
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const scenes = await sceneController.getScenesByChapterId(userId, params.chapterId, query)
      return c.json(scenes, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

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
    tags: ['Scenes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = SceneCreateSchema.parse(body)
    try {
      const scene = await sceneController.createScene(userId, data)
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
      query: IncludeQuerySchema, // Add this line
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const query = IncludeQuerySchema.parse(c.req.query()) // Parse query
    try {
      const scene = await sceneController.getScene(userId, params.id, query.include) // Pass include
      return c.json(scene, 200)
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
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Scene not found',
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = SceneUpdateSchema.parse(body)
    try {
      const updatedScene = await sceneController.updateScene(userId, params.id, data)
      return c.json(updatedScene, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PATCH /:id (Partial Update)
sceneRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a scene by ID',
    description:
      'Partially updates an existing scene by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: SceneUpdateSchema, // SceneUpdateSchema already has optional fields
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
            schema: ErrorResponseSchema,
          },
        },
      },
      404: {
        description: 'Scene not found',
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = SceneUpdateSchema.parse(body) // SceneUpdateSchema already handles optional fields
    try {
      const updatedScene = await sceneController.updateScene(userId, params.id, data) // Reusing updateScene for now
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
    },
    responses: {
      204: {
        description: 'Scene deleted successfully (No Content)',
      },
      404: {
        description: 'Scene not found',
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await sceneController.deleteScene(userId, params.id)
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
sceneRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bulk-delete',
    summary: 'Bulk delete scenes',
    description: 'Deletes multiple scenes by their IDs.',
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
    tags: ['Scenes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const { ids } = BulkDeleteSchema.parse(body)
    try {
      const result = await sceneController.bulkDeleteScenes(userId, ids)
      return c.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default sceneRoutes
