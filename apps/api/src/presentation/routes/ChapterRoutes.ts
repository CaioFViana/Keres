import {
  CreateChapterUseCase,
  DeleteChapterUseCase,
  GetChaptersByStoryIdUseCase,
  GetChapterUseCase,
  UpdateChapterUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator'
import { ChapterRepository } from '@infrastructure/persistence/ChapterRepository'
import { ChapterCreateSchema, ChapterUpdateSchema, ChapterResponseSchema } from '@keres/shared'
import { ChapterController } from '@presentation/controllers/ChapterController'
import { OpenAPIHono, createRoute } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing ChapterRoutes...')

const chapterRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for ChapterController
console.log('Instantiating ChapterRepository...')
const chapterRepository = new ChapterRepository()
console.log('Instantiating CreateChapterUseCase...')
const createChapterUseCase = new CreateChapterUseCase(chapterRepository)
console.log('Instantiating GetChapterUseCase...')
const getChapterUseCase = new GetChapterUseCase(chapterRepository)
console.log('Instantiating UpdateChapterUseCase...')
const updateChapterUseCase = new UpdateChapterUseCase(chapterRepository)
console.log('Instantiating DeleteChapterUseCase...')
const deleteChapterUseCase = new DeleteChapterUseCase(chapterRepository)
console.log('Instantiating GetChaptersByStoryIdUseCase...')
const getChaptersByStoryIdUseCase = new GetChaptersByStoryIdUseCase(chapterRepository)

console.log('Instantiating ChapterController...')
const chapterController = new ChapterController(
  createChapterUseCase,
  getChapterUseCase,
  updateChapterUseCase,
  deleteChapterUseCase,
  getChaptersByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Chapters'],
  }),
  (c) => chapterController.createChapter(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Chapters'],
  }),
  (c) => chapterController.getChapter(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Chapters'],
  }),
  (c) => chapterController.getChaptersByStoryId(c),
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
            schema: z.object({ message: z.string() }),
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
    tags: ['Chapters'],
  }),
  (c) => chapterController.updateChapter(c),
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
            schema: z.object({ message: z.string() }),
          },
        },
      },
    },
    tags: ['Chapters'],
  }),
  (c) => chapterController.deleteChapter(c),
)

console.log('ChapterRoutes initialized.')

export default chapterRoutes