import {
  CreateTagUseCase,
  DeleteTagUseCase,
  GetTagsByStoryIdUseCase,
  GetTagUseCase,
  UpdateTagUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { TagRepository } from '@infrastructure/persistence/TagRepository'
import { CreateTagSchema, TagResponseSchema, UpdateTagSchema } from '@keres/shared'
import { TagController } from '@presentation/controllers/TagController'
import { z } from 'zod'

console.log('Initializing TagRoutes...')

const tagRoutes = new OpenAPIHono()

// Dependencies for TagController
console.log('Instantiating TagRepository...')
const tagRepository = new TagRepository()
console.log('Instantiating CreateTagUseCase...')
const createTagUseCase = new CreateTagUseCase(tagRepository)
console.log('Instantiating GetTagUseCase...')
const getTagUseCase = new GetTagUseCase(tagRepository)
console.log('Instantiating UpdateTagUseCase...')
const updateTagUseCase = new UpdateTagUseCase(tagRepository)
console.log('Instantiating DeleteTagUseCase...')
const deleteTagUseCase = new DeleteTagUseCase(tagRepository)
console.log('Instantiating GetTagsByStoryIdUseCase...')
const getTagsByStoryIdUseCase = new GetTagsByStoryIdUseCase(tagRepository)

console.log('Instantiating TagController...')
const tagController = new TagController(
  createTagUseCase,
  getTagUseCase,
  updateTagUseCase,
  deleteTagUseCase,
  getTagsByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
})

// POST /
tagRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new tag',
    description: 'Creates a new tag for a story.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateTagSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Tag created successfully',
        content: {
          'application/json': {
            schema: TagResponseSchema,
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
    tags: ['Tags'],
  }),
  async (c) => {
    const body = await c.req.json()
    const data = CreateTagSchema.parse(body)
    try {
      const newTag = await tagController.createTag(data)
      return c.json(newTag, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
tagRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a tag by ID',
    description: 'Retrieves a single tag by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Tag retrieved successfully',
        content: {
          'application/json': {
            schema: TagResponseSchema,
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
        description: 'Tag not found',
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
    tags: ['Tags'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      const tag = await tagController.getTag(params.id)
      if (!tag) {
        return c.json({ error: 'Tag not found' }, 404)
      }
      return c.json(tag, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /story/:storyId
tagRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get tags by story ID',
    description: 'Retrieves all tags associated with a specific story.',
    request: {
      params: StoryIdParamSchema,
    },
    responses: {
      200: {
        description: 'Tags retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(TagResponseSchema),
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
    tags: ['Tags'],
  }),
  async (c) => {
    const params = StoryIdParamSchema.parse(c.req.param())
    try {
      const tags = await tagController.getTagsByStoryId(params.storyId)
      return c.json(tags, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
tagRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a tag by ID',
    description: 'Updates an existing tag by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateTagSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Tag updated successfully',
        content: {
          'application/json': {
            schema: TagResponseSchema,
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
        description: 'Tag not found',
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
    tags: ['Tags'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateTagSchema.parse(body)
    try {
      const updatedTag = await tagController.updateTag(params.id, data)
      if (!updatedTag) {
        return c.json({ error: 'Tag not found' }, 404)
      }
      return c.json(updatedTag, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
tagRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a tag by ID',
    description: 'Deletes a tag by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Tag deleted successfully (No Content)',
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
        description: 'Tag not found',
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
    tags: ['Tags'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      await tagController.deleteTag(params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

console.log('TagRoutes initialized.')

export default tagRoutes
