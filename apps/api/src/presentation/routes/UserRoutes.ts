import {
  AuthenticateUserUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  GetUserProfileUseCase,
  RefreshTokenUseCase,
  DeleteStoryUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import {
  StoryRepository,
  ChapterRepository,
  CharacterRepository,
  ChoiceRepository,
  GalleryRepository,
  LocationRepository,
  MomentRepository,
  NoteRepository,
  SceneRepository,
  SuggestionRepository,
  TagRepository,
  WorldRuleRepository,
  CharacterMomentRepository,
  CharacterRelationRepository,
} from '@infrastructure/persistence'
import { UserRepository } from '@infrastructure/persistence/UserRepository'
import { BcryptPasswordHasher } from '@infrastructure/services/BcryptPasswordHasher'
import { JwtService } from '@infrastructure/services/JwtService'
import {
  ErrorResponseSchema,
  UserLoginSchema,
  UserProfileSchema,
  UserRegisterSchema,
  IdParamSchema,
  RefreshTokenRequestSchema,
  RefreshTokenResponseSchema,
} from '@keres/shared' // Import Zod schemas and UserProfileSchema
import { UserController } from '@presentation/controllers/UserController'
import { z } from 'zod' // Import z for defining parameters

const userRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for UserController
const userRepository = new UserRepository()
const storyRepository = new StoryRepository()
const chapterRepository = new ChapterRepository()
const characterRepository = new CharacterRepository()
const choiceRepository = new ChoiceRepository()
const galleryRepository = new GalleryRepository()
const locationRepository = new LocationRepository()
const momentRepository = new MomentRepository()
const noteRepository = new NoteRepository()
const sceneRepository = new SceneRepository()
const suggestionRepository = new SuggestionRepository()
const tagRepository = new TagRepository()
const worldRuleRepository = new WorldRuleRepository()
const characterMomentRepository = new CharacterMomentRepository()
const characterRelationRepository = new CharacterRelationRepository()

const passwordHasher = new BcryptPasswordHasher()
const createUserUseCase = new CreateUserUseCase(userRepository, passwordHasher)

const deleteStoryUseCase = new DeleteStoryUseCase(
  storyRepository,
  chapterRepository,
  sceneRepository,
  choiceRepository,
  momentRepository,
  characterRepository,
  locationRepository,
  galleryRepository,
  worldRuleRepository,
  noteRepository,
  tagRepository,
  suggestionRepository,
  characterMomentRepository,
  characterRelationRepository,
)

const deleteUserUseCase = new DeleteUserUseCase(userRepository, storyRepository, deleteStoryUseCase)

const jwtService = new JwtService()
const authenticateUserUseCase = new AuthenticateUserUseCase(
  userRepository,
  passwordHasher,
  jwtService,
)
const refreshTokenUseCase = new RefreshTokenUseCase(jwtService, userRepository)

console.log('Instantiating GetUserProfileUseCase...')
const getUserProfileUseCase = new GetUserProfileUseCase(userRepository)

console.log('Instantiating UserController...')
const userController = new UserController(
  createUserUseCase,
  authenticateUserUseCase,
  getUserProfileUseCase,
  deleteUserUseCase,
)



// POST /register
userRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/register',
    summary: 'Register a new user',
    description: 'Registers a new user with a username and password.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: UserRegisterSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'User registered successfully',
        content: {
          'application/json': {
            schema: UserProfileSchema, // Assuming UserProfileSchema is returned on successful registration
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
    tags: ['Users'],
    security: [],
  }),
  async (c) => {
    const body = await c.req.json()
    const data = UserRegisterSchema.parse(body)
    try {
      const userProfile = await userController.createUser(data)
      return c.json(userProfile, 201)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// POST /login
userRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/login',
    summary: 'Authenticate user login',
    description: 'Authenticates a user and returns a token (or success message).',
    request: {
      body: {
        content: {
          'application/json': {
            schema: UserLoginSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Login successful',
        content: {
          'application/json': {
            schema: UserProfileSchema, // Changed to UserProfileSchema
          },
        },
      },
      401: {
        description: 'Unauthorized',
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
    tags: ['Users'],
    security: [],
  }),
  async (c) => {
    const body = await c.req.json()
    const data = UserLoginSchema.parse(body)
    try {
      const userProfile = await userController.authenticateUser(data) // Modified
      return c.json(userProfile, 200) // Modified
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 401)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// POST /refresh-token
userRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/refresh-token',
    summary: 'Refresh access token',
    description: 'Exchanges a valid refresh token for a new access token.',
    request: {
      body: {
        content: {
          'application/json': {
            schema: RefreshTokenRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Access token refreshed successfully',
        content: {
          'application/json': {
            schema: RefreshTokenResponseSchema,
          },
        },
      },
      401: {
        description: 'Unauthorized',
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
    tags: ['Users'],
    security: [],
  }),
  async (c) => {
    const body = await c.req.json()
    const { refreshToken } = RefreshTokenRequestSchema.parse(body)
    try {
      const result = await refreshTokenUseCase.execute(refreshToken)
      if (!result) {
        return c.json({ error: 'Invalid refresh token' }, 401)
      }
      return c.json(result, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 401)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

// GET /profile/:id
userRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/profile/{id}',
    summary: 'Get user profile by ID',
    description: "Retrieves a user's profile information by their unique ID.",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        description: 'User profile retrieved successfully',
        content: {
          'application/json': {
            schema: UserProfileSchema,
          },
        },
      },
      404: {
        description: 'User not found',
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
    tags: ['Users'],
    security: [],
  }),
  async (c) => {
    const params = IdParamSchema.parse(c.req.param())
    try {
      const userProfile = await userController.getUserProfile(params.id)
      return c.json(userProfile, 200)
    } catch (error: unknown) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 404)
      }
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  },
)

export default userRoutes
