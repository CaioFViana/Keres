import {
  CreateChoiceUseCase,
  DeleteChoiceUseCase,
  GetChoicesBySceneIdUseCase,
  GetChoiceUseCase,
  UpdateChoiceUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { ChoiceRepository } from '@infrastructure/persistence/ChoiceRepository'
import { ChoiceResponseSchema, CreateChoiceSchema, UpdateChoiceSchema } from '@keres/shared' // Use alias
import { ChoiceController } from '@presentation/controllers/ChoiceController' // Use alias
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing ChoiceRoutes...')

export const choiceRoutes = new OpenAPIHono()

// Dependencies for ChoiceController
console.log('Instantiating ChoiceRepository...')
const choiceRepository = new ChoiceRepository()
console.log('Instantiating CreateChoiceUseCase...')
const createChoiceUseCase = new CreateChoiceUseCase(choiceRepository)
console.log('Instantiating GetChoiceUseCase...')
const getChoiceUseCase = new GetChoiceUseCase(choiceRepository)
console.log('Instantiating UpdateChoiceUseCase...')
const updateChoiceUseCase = new UpdateChoiceUseCase(choiceRepository)
console.log('Instantiating DeleteChoiceUseCase...')
const deleteChoiceUseCase = new DeleteChoiceUseCase(choiceRepository)
console.log('Instantiating GetChoicesBySceneIdUseCase...')
const getChoicesBySceneIdUseCase = new GetChoicesBySceneIdUseCase(choiceRepository)

console.log('Instantiating ChoiceController...')
const choiceController = new ChoiceController(
  createChoiceUseCase,
  getChoiceUseCase,
  updateChoiceUseCase,
  deleteChoiceUseCase,
  getChoicesBySceneIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const SceneIdParamSchema = z.object({
  sceneId: z.ulid(),
})

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
    const body = await c.req.json()
    const data = CreateChoiceSchema.parse(body)
    try {
      const newChoice = await choiceController.createChoice(data)
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
    const params = IdParamSchema.parse(c.req.param())
    try {
      const choice = await choiceController.getChoice(params.id)
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
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateChoiceSchema.parse(body)
    try {
      const updatedChoice = await choiceController.updateChoice(params.id, data)
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
    const params = IdParamSchema.parse(c.req.param())
    try {
      await choiceController.deleteChoice(params.id)
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
    const params = SceneIdParamSchema.parse(c.req.param())
    try {
      const choices = await choiceController.getChoicesBySceneId(params.sceneId)
      return c.json(choices, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

console.log('ChoiceRoutes initialized.')

export default choiceRoutes
