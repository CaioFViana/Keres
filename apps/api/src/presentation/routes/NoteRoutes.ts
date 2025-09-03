import {
  CreateNoteUseCase,
  DeleteNoteUseCase,
  GetNotesByStoryIdUseCase,
  GetNoteUseCase,
  UpdateNoteUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { NoteRepository } from '@infrastructure/persistence/NoteRepository'
import { CreateNoteSchema, NoteResponseSchema, UpdateNoteSchema } from '@keres/shared'
import { NoteController } from '@presentation/controllers/NoteController'
import { z } from 'zod'


const noteRoutes = new OpenAPIHono()

// Dependencies for NoteController
const noteRepository = new NoteRepository()
const createNoteUseCase = new CreateNoteUseCase(noteRepository)
const getNoteUseCase = new GetNoteUseCase(noteRepository)
const updateNoteUseCase = new UpdateNoteUseCase(noteRepository)
const deleteNoteUseCase = new DeleteNoteUseCase(noteRepository)
const getNotesByStoryIdUseCase = new GetNotesByStoryIdUseCase(noteRepository)


const noteController = new NoteController(
  createNoteUseCase,
  getNoteUseCase,
  updateNoteUseCase,
  deleteNoteUseCase,
  getNotesByStoryIdUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
})

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
    tags: ['Notes'],
  }),
  async (c) => {
    const body = await c.req.json()
    const data = CreateNoteSchema.parse(body)
    try {
      const newNote = await noteController.createNote(data)
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Note not found',
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
    tags: ['Notes'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      const note = await noteController.getNote(params.id)
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
    },
    responses: {
      200: {
        description: 'Notes retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(NoteResponseSchema),
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
    tags: ['Notes'],
  }),
  async (c) => {
    const params = StoryIdParamSchema.parse(c.req.param())
    try {
      const notes = await noteController.getNotesByStoryId(params.storyId)
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Note not found',
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
    tags: ['Notes'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    const body = await c.req.json()
    const data = UpdateNoteSchema.parse(body)
    try {
      const updatedNote = await noteController.updateNote(params.id, data)
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
            schema: z.object({ error: z.string() }),
          },
        },
      },
      404: {
        description: 'Note not found',
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
    tags: ['Notes'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      await noteController.deleteNote(params.id)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)


export default noteRoutes
