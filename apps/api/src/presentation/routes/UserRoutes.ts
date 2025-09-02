import {
  AuthenticateUserUseCase,
  CreateUserUseCase,
  GetUserProfileUseCase,
} from '@application/use-cases'
import { createRoute, OpenAPIHono } from '@hono/zod-openapi' // Import createRoute and OpenAPIHono
import { UserRepository } from '@infrastructure/persistence/UserRepository'
import { BcryptPasswordHasher } from '@infrastructure/services/BcryptPasswordHasher'
import { JwtService } from '@infrastructure/services/JwtService' // Added
import { UserLoginSchema, UserProfileSchema, UserRegisterSchema } from '@keres/shared' // Import Zod schemas and UserProfileSchema
import { UserController } from '@presentation/controllers/UserController'
import { z } from 'zod' // Import z for defining parameters

console.log('Initializing UserRoutes...')

const userRoutes = new OpenAPIHono() // Change Hono to OpenAPIHono

// Dependencies for UserController
console.log('Instantiating UserRepository...')
const userRepository = new UserRepository()
console.log('Instantiating BcryptPasswordHasher...')
const passwordHasher = new BcryptPasswordHasher()
console.log('Instantiating CreateUserUseCase...')
const createUserUseCase = new CreateUserUseCase(userRepository, passwordHasher)
console.log('Instantiating AuthenticateUserUseCase...')
console.log('Instantiating JwtService...') // Added
const jwtService = new JwtService() // Added
const authenticateUserUseCase = new AuthenticateUserUseCase(
  userRepository,
  passwordHasher,
  jwtService,
) // Modified
console.log('Instantiating GetUserProfileUseCase...')
const getUserProfileUseCase = new GetUserProfileUseCase(userRepository)

console.log('Instantiating UserController...')
const userController = new UserController(
  createUserUseCase,
  authenticateUserUseCase,
  getUserProfileUseCase,
)

// Define schemas for path parameters
const IdParamSchema = z.object({
  id: z.ulid(),
})

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

console.log('UserRoutes initialized.')

export default userRoutes
