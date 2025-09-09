import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import {
  CharacterRepository,
  NoteRepository,
  StoryRepository,
  WorldRuleRepository,
  LocationRepository,
  ChapterRepository,
  ChoiceRepository,
  MomentRepository,
  SceneRepository,
  SuggestionRepository,
} from '@infrastructure/persistence'
import { GlobalSearchUseCase } from '@application/use-cases/search/GlobalSearchUseCase'
import { SearchController } from '@presentation/controllers/SearchController'
import { ErrorResponseSchema, SearchQuerySchema, SearchResponseSchema } from '@keres/shared'
import { z } from 'zod'

const searchRoutes = new OpenAPIHono()

// Dependencies for SearchController
const storyRepository = new StoryRepository()
const noteRepository = new NoteRepository()
const characterRepository = new CharacterRepository()
const worldRuleRepository = new WorldRuleRepository()
const locationRepository = new LocationRepository()
const chapterRepository = new ChapterRepository()
const choiceRepository = new ChoiceRepository()
const momentRepository = new MomentRepository()
const sceneRepository = new SceneRepository()
const suggestionRepository = new SuggestionRepository()

const globalSearchUseCase = new GlobalSearchUseCase(
  storyRepository,
  noteRepository,
  characterRepository,
  worldRuleRepository,
  locationRepository,
  chapterRepository,
  choiceRepository,
  momentRepository,
  sceneRepository,
  suggestionRepository,
)

const searchController = new SearchController(globalSearchUseCase)

// GET /search
searchRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    summary: 'Global search across entities',
    description: 'Searches for a keyword across specified entities.',
    request: {
      query: SearchQuerySchema,
    },
    responses: {
      200: {
        description: 'Search results retrieved successfully',
        content: {
          'application/json': {
            schema: SearchResponseSchema,
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
    tags: ['Search'],
  }),
  async (c) => {
    const userId = (c.get('jwtPayload') as { userId: string }).userId
    const { query, scope } = SearchQuerySchema.parse(c.req.query())
    try {
      const results = await searchController.globalSearch(query, scope, userId)
      return c.json(results, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default searchRoutes
