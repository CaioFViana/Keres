import {
  BulkDeleteNoteUseCase,
  CreateNoteUseCase,
  DeleteNoteUseCase,
  GetNotesByStoryIdUseCase,
  GetNoteUseCase,
  UpdateNoteUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { GalleryRepository, NoteRepository, StoryRepository } from '@infrastructure/persistence'
import {
  BulkDeleteResponseSchema,
  CreateNoteSchema,
  ErrorResponseSchema,
  ListQuerySchema,
  NoteResponseSchema,
  UpdateNoteSchema,
  IdParamSchema,
  StoryIdParamSchema,
  BulkDeleteSchema,
  PaginatedResponseSchema,
} from '@keres/shared'
import { NoteController } from '@presentation/controllers/NoteController'

const noteRoutes = new OpenAPIHono()

// Dependencies for NoteController
const noteRepository = new NoteRepository()
const storyRepository = new StoryRepository()
const galleryRepository = new GalleryRepository()
const createNoteUseCase = new CreateNoteUseCase(noteRepository, storyRepository, galleryRepository)
const getNoteUseCase = new GetNoteUseCase(noteRepository, storyRepository)
const updateNoteUseCase = new UpdateNoteUseCase(noteRepository, storyRepository, galleryRepository)
const deleteNoteUseCase = new DeleteNoteUseCase(noteRepository, storyRepository)
const bulkDeleteNoteUseCase = new BulkDeleteNoteUseCase(
  // Added
  noteRepository,
  storyRepository,
)
const getNotesByStoryIdUseCase = new GetNotesByStoryIdUseCase(noteRepository, storyRepository)

const noteController = new NoteController(
  createNoteUseCase,
  getNoteUseCase,
  updateNoteUseCase,
  deleteNoteUseCase,
  bulkDeleteNoteUseCase,
  getNotesByStoryIdUseCase,
)



// POST /
noteRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new note',
    description: 'Creates a new note for a story.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateNoteSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Note created successfully',
        content: {
          'application/json': {
            schema: NoteResponseSchema,
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
    tags: ['Notes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const data = CreateNoteSchema.parse(body)
    try {
      const newNote = await noteController.createNote(userId, data)
      return c.json(newNote, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /:id
noteRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a note by ID',
    description: 'Retrieves a single note by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Note retrieved successfully',
        content: {
          'application/json': {
            schema: NoteResponseSchema,
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
        description: 'Note not found',
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
    tags: ['Notes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      const note = await noteController.getNote(userId, params.id)
      if (!note) {
        return c.json({ error: 'Note not found' }, 404)
      }
      return c.json(note, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /story/:storyId
noteRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get notes by story ID',
    description: 'Retrieves all notes associated with a specific story.',
    request: {
      params: StoryIdParamSchema,
      query: ListQuerySchema,
    },
    responses: {
      200: {
        description: 'Notes retrieved successfully',
        content: {
          'application/json': {
            schema: PaginatedResponseSchema(NoteResponseSchema),
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
    tags: ['Notes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = StoryIdParamSchema.parse(c.req.param())
    const query = ListQuerySchema.parse(c.req.query())
    try {
      const notes = await noteController.getNotesByStoryId(userId, params.storyId, query)
      return c.json(notes, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PUT /:id
noteRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a note by ID',
    description: 'Updates an existing note by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateNoteSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Note updated successfully',
        content: {
          'application/json': {
            schema: NoteResponseSchema,
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
        description: 'Note not found',
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
    tags: ['Notes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    // Explicitly remove 'id' from the body before parsing
    const { id, ...restOfBody } = body
    const data = UpdateNoteSchema.parse(restOfBody)
    try {
      const updatedNote = await noteController.updateNote(userId, params.id, data)
      if (!updatedNote) {
        return c.json({ error: 'Note not found' }, 404)
      }
      return c.json(updatedNote, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// PATCH /:id (Partial Update)
noteRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/{id}',
    summary: 'Partially update a note by ID',
    description:
      'Partially updates an existing note by its unique ID. Only provided fields will be updated.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateNoteSchema, // UpdateNoteSchema already has optional fields
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Note updated successfully',
        content: {
          'application/json': {
            schema: NoteResponseSchema,
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
        description: 'Note not found',
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
    tags: ['Notes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    // Explicitly remove 'id' from the body before parsing
    const { id, ...restOfBody } = body
    const data = UpdateNoteSchema.parse(restOfBody) // UpdateNoteSchema already handles optional fields
    try {
      const updatedNote = await noteController.updateNote(userId, params.id, data) // Reusing updateNote for now
      if (!updatedNote) {
        return c.json({ error: 'Note not found' }, 404)
      }
      return c.json(updatedNote, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// DELETE /:id
noteRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a note by ID',
    description: 'Deletes a note by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Note deleted successfully (No Content)',
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
        description: 'Note not found',
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
    tags: ['Notes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const params = IdParamSchema.parse(c.req.param())
    try {
      await noteController.deleteNote(userId, params.id)
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
noteRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bulk-delete',
    summary: 'Bulk delete notes',
    description: 'Deletes multiple notes by their IDs.',
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
    tags: ['Notes'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const body = await c.req.json()
    const { ids } = BulkDeleteSchema.parse(body)
    try {
      const result = await noteController.bulkDeleteNotes(userId, ids)
      return c.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default noteRoutes
