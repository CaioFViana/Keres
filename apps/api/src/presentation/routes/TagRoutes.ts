import {
  AddTagToEntityUseCase,
  CreateTagUseCase,
  DeleteTagUseCase,
  GetTagsByStoryIdUseCase,
  GetTagUseCase,
  RemoveTagFromEntityUseCase,
  UpdateTagUseCase,
} from '@application/use-cases/tag'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import {
  ChapterRepository,
  CharacterRepository,
  LocationRepository,
  SceneRepository,
  StoryRepository,
  TagRepository,
} from '@infrastructure/persistence'
import {
  CreateTagSchema,
  TagAssignmentSchema,
  TagRemovalSchema,
  TagResponseSchema,
  UpdateTagSchema,
} from '@keres/shared'
import { TagController } from '@presentation/controllers/TagController'
import { z } from 'zod'

const tagRoutes = new OpenAPIHono()

// Dependencies for TagController
const tagRepository = new TagRepository()
const storyRepository = new StoryRepository()
const characterRepository = new CharacterRepository()
const locationRepository = new LocationRepository()
const chapterRepository = new ChapterRepository()
const sceneRepository = new SceneRepository()

const createTagUseCase = new CreateTagUseCase(tagRepository, storyRepository)
const getTagUseCase = new GetTagUseCase(tagRepository, storyRepository)
const getTagsByStoryIdUseCase = new GetTagsByStoryIdUseCase(tagRepository, storyRepository)
const updateTagUseCase = new UpdateTagUseCase(tagRepository, storyRepository)
const deleteTagUseCase = new DeleteTagUseCase(tagRepository, storyRepository)
const addTagToEntityUseCase = new AddTagToEntityUseCase(
  tagRepository,
  storyRepository,
  characterRepository,
  locationRepository,
  chapterRepository,
  sceneRepository,
)
const removeTagFromEntityUseCase = new RemoveTagFromEntityUseCase(
  tagRepository,
  storyRepository,
  characterRepository,
  locationRepository,
  chapterRepository,
  sceneRepository,
)

const tagController = new TagController(
  createTagUseCase,
  getTagUseCase,
  getTagsByStoryIdUseCase,
  updateTagUseCase,
  deleteTagUseCase,
  addTagToEntityUseCase,
  removeTagFromEntityUseCase,
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
    description: 'Creates a new tag in a story.',
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CreateTagSchema.parse(body)
    try {
      const tag = await tagController.createTag(userId, data)
      return c.json(tag, 201)
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const tag = await tagController.getTag(userId, params.id)
      return c.json(tag, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
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
    description: 'Retrieves all tags belonging to a specific story.',
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
      404: {
        description: 'Story not found',
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = StoryIdParamSchema.parse(c.req.param())
    try {
      const tags = await tagController.getTagsByStoryId(userId, params.storyId)
      return c.json(tags, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
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
        description: 'Internal server error',
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateTagSchema.parse(body)
    try {
      const updatedTag = await tagController.updateTag(userId, params.id, data)
      return c.json(updatedTag, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PATCH /:id (Partial Update)
tagRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a tag by ID',
    description: 'Partially updates an existing tag by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateTagSchema, // UpdateTagSchema already has optional fields
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateTagSchema.parse(body) // UpdateTagSchema already handles optional fields
    try {
      const updatedTag = await tagController.updateTag(userId, params.id, data) // Reusing updateTag for now
      return c.json(updatedTag, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await tagController.deleteTag(userId, params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// POST /add
tagRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/add',
    summary: 'Add a tag to an entity',
    description: 'Assigns a tag to a specified entity (Character, Location, Chapter, or Scene).',
    request: {
      body: {
        content: {
          'application/json': {
            schema: TagAssignmentSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Tag added successfully',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
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
        description: 'Not Found',
        content: {
          application: {
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = TagAssignmentSchema.parse(body)
    try {
      await tagController.addTag(userId, data)
      return c.json({ message: 'Tag added successfully' }, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /remove
tagRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/remove',
    summary: 'Remove a tag from an entity',
    description: 'Removes a tag from a specified entity (Character, Location, Chapter, or Scene).',
    request: {
      body: {
        content: {
          'application/json': {
            schema: TagRemovalSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Tag removed successfully',
        content: {
          'application/json': {
            schema: z.object({ message: z.string() }),
          },
        },
      },
      400: {
        description: 'Bad Request',
        content: {
          application: {
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Not Found',
        content: {
          application: {
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
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = TagRemovalSchema.parse(body)
    try {
      await tagController.removeTag(userId, data)
      return c.json({ message: 'Tag removed successfully' }, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default tagRoutes
