import {
  BulkDeleteChapterUseCase,
  CreateChapterUseCase,
  DeleteChapterUseCase,
  GetChaptersByStoryIdUseCase,
  GetChapterUseCase,
  UpdateChapterUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { ChapterRepository, SceneRepository, StoryRepository } from '@infrastructure/persistence'
import {
  BulkDeleteResponseSchema,
  ChapterCreateSchema,
  ChapterResponseSchema,
  ChapterUpdateSchema,
  ErrorResponseSchema,
  ListQuerySchema,
} from '@keres/shared'
import { ChapterController } from '@presentation/controllers/ChapterController'
import { z } from 'zod' // Import z for defining parameters

const chapterRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for ChapterController
const chapterRepository = new ChapterRepository()
const storyRepository = new StoryRepository()
const sceneRepository = new SceneRepository()
const createChapterUseCase = new CreateChapterUseCase(chapterRepository, storyRepository)
const getChapterUseCase = new GetChapterUseCase(chapterRepository, storyRepository, sceneRepository)
const updateChapterUseCase = new UpdateChapterUseCase(chapterRepository, storyRepository)
const deleteChapterUseCase = new DeleteChapterUseCase(
  chapterRepository,
  storyRepository,
  sceneRepository,
)
const bulkDeleteChapterUseCase = new BulkDeleteChapterUseCase(
  chapterRepository,
  storyRepository,
  sceneRepository,
)
const getChaptersByStoryIdUseCase = new GetChaptersByStoryIdUseCase(
  chapterRepository,
  storyRepository,
)

const chapterController = new ChapterController(
  createChapterUseCase,
  getChapterUseCase,
  updateChapterUseCase,
  deleteChapterUseCase,
  bulkDeleteChapterUseCase,
  getChaptersByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
})

// Define schema for include query parameter
const IncludeQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : [])),
})

// Define schema for bulk delete request body
const BulkDeleteSchema = z.object({
  ids: z.array(z.ulid()),
})

// POST /
chapterRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new chapter',
    description: 'Creates a new chapter in a story.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: ChapterCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Chapter created successfully',
        content: {
          'application/json': {
            schema: ChapterResponseSchema,
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
    tags: ['Chapters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = ChapterCreateSchema.parse(body)
    try {
      const chapter = await chapterController.createChapter(userId, data)
      return c.json(chapter, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
chapterRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a chapter by ID',
    description: 'Retrieves a single chapter by its unique ID.',
    request: {
      params: IdParamSchema,
      query: IncludeQuerySchema, // Add this line
    },
    responses: {
      200: {
        description: 'Chapter retrieved successfully',
        content: {
          'application/json': {
            schema: ChapterResponseSchema,
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
    tags: ['Chapters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const query = IncludeQuerySchema.parse(c.req.query()) // Parse query
    try {
      const chapter = await chapterController.getChapter(userId, params.id, query.include) // Pass include
      return c.json(chapter, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /story/:storyId
chapterRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get chapters by story ID',
    description: 'Retrieves all chapters belonging to a specific story.',
    request: {
      params: StoryIdParamSchema,
      query: ListQuerySchema,
    },
    responses: {
      200: {
        description: 'Chapters retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(ChapterResponseSchema),
          },
        },
      },
      404: {
        description: 'Story not found',
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
    tags: ['Chapters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = StoryIdParamSchema.parse(c.req.param())
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const chapters = await chapterController.getChaptersByStoryId(userId, params.storyId, query)
      return c.json(chapters, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
chapterRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a chapter by ID',
    description: 'Updates an existing chapter by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: ChapterUpdateSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Chapter updated successfully',
        content: {
          'application/json': {
            schema: ChapterResponseSchema,
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
        description: 'Chapter not found',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
    tags: ['Chapters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    // Explicitly remove 'id' from the body before parsing
    const { id, ...restOfBody } = body
    const data = ChapterUpdateSchema.parse(restOfBody)
    try {
      const updatedChapter = await chapterController.updateChapter(userId, params.id, data)
      return c.json(updatedChapter, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PATCH /:id (Partial Update)
chapterRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a chapter by ID',
    description:
      'Partially updates an existing chapter by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: ChapterUpdateSchema, // ChapterUpdateSchema already has optional fields
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Chapter updated successfully',
        content: {
          'application/json': {
            schema: ChapterResponseSchema,
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
    tags: ['Chapters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    // Explicitly remove 'id' from the body before parsing
    const { id, ...restOfBody } = body
    const data = ChapterUpdateSchema.parse(restOfBody) // ChapterUpdateSchema already handles optional fields
    try {
      const updatedChapter = await chapterController.updateChapter(userId, params.id, data) // Reusing updateChapter for now
      return c.json(updatedChapter, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
chapterRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a chapter by ID',
    description: 'Deletes a chapter by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Chapter deleted successfully (No Content)',
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
    tags: ['Chapters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await chapterController.deleteChapter(userId, params.id)
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
chapterRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bulk-delete',
    summary: 'Bulk delete chapters',
    description: 'Deletes multiple chapters by their IDs.',
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
    tags: ['Chapters'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const { ids } = BulkDeleteSchema.parse(body)
    try {
      const result = await chapterController.bulkDeleteChapters(userId, ids)
      return c.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default chapterRoutes
