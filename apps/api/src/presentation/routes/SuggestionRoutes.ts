import {
  CreateSuggestionUseCase,
  DeleteSuggestionUseCase,
  GetSuggestionUseCase,
  UpdateSuggestionUseCase,
  GetSuggestionsByUserIdUseCase,
  GetSuggestionsByStoryIdUseCase,
  GetSuggestionsByTypeUseCase,
  GetSuggestionsByUserAndTypeUseCase,
  GetSuggestionsByStoryAndTypeUseCase,
} from '@application/use-cases';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { SuggestionRepository } from '@infrastructure/persistence/SuggestionRepository';
import { CreateSuggestionSchema, SuggestionResponseSchema, UpdateSuggestionSchema } from '@keres/shared';
import { SuggestionController } from '@presentation/controllers/SuggestionController';
import { z } from 'zod';

console.log('Initializing SuggestionRoutes...');

const suggestionRoutes = new OpenAPIHono();

// Dependencies for SuggestionController
console.log('Instantiating SuggestionRepository...');
const suggestionRepository = new SuggestionRepository();
console.log('Instantiating CreateSuggestionUseCase...');
const createSuggestionUseCase = new CreateSuggestionUseCase(suggestionRepository);
console.log('Instantiating GetSuggestionUseCase...');
const getSuggestionUseCase = new GetSuggestionUseCase(suggestionRepository);
console.log('Instantiating UpdateSuggestionUseCase...');
const updateSuggestionUseCase = new UpdateSuggestionUseCase(suggestionRepository);
console.log('Instantiating DeleteSuggestionUseCase...');
const deleteSuggestionUseCase = new DeleteSuggestionUseCase(suggestionRepository);
console.log('Instantiating GetSuggestionsByUserIdUseCase...');
const getSuggestionsByUserIdUseCase = new GetSuggestionsByUserIdUseCase(suggestionRepository);
console.log('Instantiating GetSuggestionsByStoryIdUseCase...');
const getSuggestionsByStoryIdUseCase = new GetSuggestionsByStoryIdUseCase(suggestionRepository);
console.log('Instantiating GetSuggestionsByTypeUseCase...');
const getSuggestionsByTypeUseCase = new GetSuggestionsByTypeUseCase(suggestionRepository);
console.log('Instantiating GetSuggestionsByUserAndTypeUseCase...');
const getSuggestionsByUserAndTypeUseCase = new GetSuggestionsByUserAndTypeUseCase(suggestionRepository);
console.log('Instantiating GetSuggestionsByStoryAndTypeUseCase...');
const getSuggestionsByStoryAndTypeUseCase = new GetSuggestionsByStoryAndTypeUseCase(suggestionRepository);

console.log('Instantiating SuggestionController...');
const suggestionController = new SuggestionController(
  createSuggestionUseCase,
  getSuggestionUseCase,
  updateSuggestionUseCase,
  deleteSuggestionUseCase,
  getSuggestionsByUserIdUseCase,
  getSuggestionsByStoryIdUseCase,
  getSuggestionsByTypeUseCase,
  getSuggestionsByUserAndTypeUseCase,
  getSuggestionsByStoryAndTypeUseCase,
);

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
});

const UserIdParamSchema = z.object({
  userId: z.ulid(),
});

const StoryIdParamSchema = z.object({
  storyId: z.ulid(),
});

const TypeParamSchema = z.object({
  type: z.string(),
});

// POST /
suggestionRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/',
    summary: 'Create a new suggestion',
    description: 'Creates a new customizable list suggestion.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: CreateSuggestionSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Suggestion created successfully',
        content: {
          'application/json': {
            schema: SuggestionResponseSchema,
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const body = await c.req.json();
    const data = CreateSuggestionSchema.parse(body);
    try {
      const newSuggestion = await suggestionController.createSuggestion(data);
      return c.json(newSuggestion, 201);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  },
);

// GET /:id
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get a suggestion by ID',
    description: 'Retrieves a single suggestion by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'Suggestion retrieved successfully',
        content: {
          'application/json': {
            schema: SuggestionResponseSchema,
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
        description: 'Suggestion not found',
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param());
    try {
      const suggestion = await suggestionController.getSuggestion(params.id);
      if (!suggestion) {
        return c.json({ error: 'Suggestion not found' }, 404);
      }
      return c.json(suggestion, 200);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  },
);

// GET /user/:userId
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/user/{userId}',
    summary: 'Get suggestions by user ID',
    description: 'Retrieves all suggestions associated with a specific user.',
    request: {
      params: UserIdParamSchema,
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const params = UserIdParamSchema.parse(c.req.param());
    try {
      const suggestions = await suggestionController.getSuggestionsByUserId(params.userId);
      return c.json(suggestions, 200);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  },
);

// GET /story/:storyId
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}',
    summary: 'Get suggestions by story ID',
    description: 'Retrieves all suggestions associated with a specific story.',
    request: {
      params: StoryIdParamSchema,
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const params = StoryIdParamSchema.parse(c.req.param());
    try {
      const suggestions = await suggestionController.getSuggestionsByStoryId(params.storyId);
      return c.json(suggestions, 200);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  },
);

// GET /type/:type
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/type/{type}',
    summary: 'Get suggestions by type',
    description: 'Retrieves all suggestions of a specific type (e.g., "genre", "character_gender").',
    request: {
      params: TypeParamSchema,
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const params = TypeParamSchema.parse(c.req.param());
    try {
      const suggestions = await suggestionController.getSuggestionsByType(params.type);
      return c.json(suggestions, 200);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  },
);

// GET /user/:userId/type/:type
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/user/{userId}/type/{type}',
    summary: 'Get suggestions by user ID and type',
    description: 'Retrieves all suggestions associated with a specific user and type.',
    request: {
      params: z.object({
        userId: z.ulid(),
        type: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const params = z.object({ userId: z.ulid(), type: z.string() }).parse(c.req.param());
    try {
      const suggestions = await suggestionController.getSuggestionsByUserAndType(params.userId, params.type);
      return c.json(suggestions, 200);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  },
);

// GET /story/:storyId/type/:type
suggestionRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/story/{storyId}/type/{type}',
    summary: 'Get suggestions by story ID and type',
    description: 'Retrieves all suggestions associated with a specific story and type.',
    request: {
      params: z.object({
        storyId: z.ulid(),
        type: z.string(),
      }),
    },
    responses: {
      200: {
        description: 'Suggestions retrieved successfully',
        content: {
          'application/json': {
            schema: z.array(SuggestionResponseSchema),
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const params = z.object({ storyId: z.ulid(), type: z.string() }).parse(c.req.param());
    try {
      const suggestions = await suggestionController.getSuggestionsByStoryAndType(params.storyId, params.type);
      return c.json(suggestions, 200);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  },
);

// PUT /:id
suggestionRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/{id}',
    summary: 'Update a suggestion by ID',
    description: 'Updates an existing suggestion by its unique ID.',
    request: {
      params: IdParamSchema,
      body: {
        content: {
          'application/json': {
            schema: UpdateSuggestionSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Suggestion updated successfully',
        content: {
          'application/json': {
            schema: SuggestionResponseSchema,
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
        description: 'Suggestion not found',
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param());
    const body = await c.req.json();
    const data = UpdateSuggestionSchema.parse(body);
    try {
      const updatedSuggestion = await suggestionController.updateSuggestion(params.id, data);
      if (!updatedSuggestion) {
        return c.json({ error: 'Suggestion not found' }, 404);
      }
      return c.json(updatedSuggestion, 200);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  },
);

// DELETE /:id
suggestionRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/{id}',
    summary: 'Delete a suggestion by ID',
    description: 'Deletes a suggestion by its unique ID.',
    request: {
      params: IdParamSchema,
    },
    responses: {
      204: {
        description: 'Suggestion deleted successfully (No Content)',
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
        description: 'Suggestion not found',
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
    tags: ['Suggestions'],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param());
    try {
      await suggestionController.deleteSuggestion(params.id);
      return c.body(null, 204);
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  },
);

console.log('SuggestionRoutes initialized.');

export default suggestionRoutes;
