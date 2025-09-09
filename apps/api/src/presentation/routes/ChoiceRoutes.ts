import {
  BulkDeleteChoiceUseCase,
  CreateChoiceUseCase,
  DeleteChoiceUseCase,
  GetChoicesBySceneIdUseCase,
  GetChoiceUseCase,
  UpdateChoiceUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  ChapterRepository,
  ChoiceRepository,
  SceneRepository,
  StoryRepository,
} from '@infrastructure/persistence'
import {
  BulkDeleteResponseSchema,
  ChoiceResponseSchema,
  CreateChoiceSchema,
  UpdateChoiceSchema,
} from '@keres/shared'
import { ChoiceController } from '@presentation/controllers/ChoiceController'
import { z } from 'zod'

export const choiceRoutes = new OpenAPIHono()

// Dependencies for ChoiceController
const choiceRepository = new ChoiceRepository()
const sceneRepository = new SceneRepository()
const chapterRepository = new ChapterRepository()
const storyRepository = new StoryRepository()
const createChoiceUseCase = new CreateChoiceUseCase(
  choiceRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const getChoiceUseCase = new GetChoiceUseCase(
  choiceRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const updateChoiceUseCase = new UpdateChoiceUseCase(
  choiceRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const deleteChoiceUseCase = new DeleteChoiceUseCase(
  choiceRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const bulkDeleteChoiceUseCase = new BulkDeleteChoiceUseCase(
  choiceRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)
const getChoicesBySceneIdUseCase = new GetChoicesBySceneIdUseCase(
  choiceRepository,
  sceneRepository,
  chapterRepository,
  storyRepository,
)

const choiceController = new ChoiceController(
  createChoiceUseCase,
  getChoiceUseCase,
  updateChoiceUseCase,
  deleteChoiceUseCase,
  bulkDeleteChoiceUseCase,
  getChoicesBySceneIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const SceneIdParamSchema = z.object({
  sceneId: z.ulid(),
})

// Define schema for bulk delete request body // Added
const BulkDeleteSchema = z.object({
  ids: z.array(z.ulid()),
}) // Added

// POST /
choiceRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new choice',
    description: 'Creates a new choice for a scene.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateChoiceSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Choice created successfully',
        content: {
          'application/json': {
            schema: ChoiceResponseSchema,
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
    tags: ['Choices'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CreateChoiceSchema.parse(body)
    try {
      const newChoice = await choiceController.createChoice(userId, data)
      return c.json(newChoice, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
choiceRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a choice by ID',
    description: 'Retrieves a single choice by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Choice retrieved successfully',
        content: {
          'application/json': {
            schema: ChoiceResponseSchema,
          },
        },
      },
      400: {
        // Added 400 response
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Choice not found',
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
    tags: ['Choices'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const choice = await choiceController.getChoice(userId, params.id)
      if (!choice) {
        return c.json({ error: 'Choice not found' }, 404)
      }
      return c.json(choice, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
choiceRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a choice by ID',
    description: 'Updates an existing choice by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateChoiceSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Choice updated successfully',
        content: {
          'application/json': {
            schema: ChoiceResponseSchema,
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
        description: 'Choice not found',
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
    tags: ['Choices'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateChoiceSchema.parse(body)
    try {
      const updatedChoice = await choiceController.updateChoice(userId, params.id, data)
      if (!updatedChoice) {
        return c.json({ error: 'Choice not found' }, 404)
      }
      return c.json(updatedChoice, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PATCH /:id (Partial Update)
choiceRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a choice by ID',
    description:
      'Partially updates an existing choice by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateChoiceSchema, // UpdateChoiceSchema already has optional fields
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Choice updated successfully',
        content: {
          'application/json': {
            schema: ChoiceResponseSchema,
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
        description: 'Choice not found',
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
    tags: ['Choices'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateChoiceSchema.parse(body) // UpdateChoiceSchema already handles optional fields
    try {
      const updatedChoice = await choiceController.updateChoice(userId, params.id, data) // Reusing updateChoice for now
      if (!updatedChoice) {
        return c.json({ error: 'Choice not found' }, 404)
      }
      return c.json(updatedChoice, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
choiceRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a choice by ID',
    description: 'Deletes a choice by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Choice deleted successfully',
      },
      404: {
        description: 'Choice not found',
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
    tags: ['Choices'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await choiceController.deleteChoice(userId, params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /by-scene/{sceneId}
choiceRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/by-scene/{sceneId}',
    summary: 'Get choices by scene ID',
    description: 'Retrieves all choices associated with a specific scene.',
    request: {
      params: SceneIdParamSchema,
    },
    responses: {
      200: {
        description: 'Choices retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(ChoiceResponseSchema),
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
    tags: ['Choices'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = SceneIdParamSchema.parse(c.req.param())
    try {
      const choices = await choiceController.getChoicesBySceneId(userId, params.sceneId)
      return c.json(choices, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// POST /bulk-delete // Added
choiceRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bulk-delete',
    summary: 'Bulk delete choices',
    description: 'Deletes multiple choices by their IDs.',
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
    tags: ['Choices'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const { ids } = BulkDeleteSchema.parse(body)
    try {
      const result = await choiceController.bulkDeleteChoices(userId, ids)
      return c.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default choiceRoutes
