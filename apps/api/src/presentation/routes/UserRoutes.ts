import {
  AuthenticateUserUseCase,
  CreateUserUseCase,
  GetUserProfileUseCase,
} from '@application/use-cases'
import { zValidator } from '@hono/zod-validator' // Import zValidator
import { UserRepository } from '@infrastructure/persistence/UserRepository'
import { BcryptPasswordHasher } from '@infrastructure/services/BcryptPasswordHasher'
import { UserLoginSchema, UserRegisterSchema } from '@keres/shared' // Import Zod schemas
import { UserController } from '@presentation/controllers/UserController'
import { Hono } from 'hono'

console.log('Initializing UserRoutes...')

const userRoutes = new Hono()

// Dependencies for UserController
console.log('Instantiating UserRepository...')
const userRepository = new UserRepository()
console.log('Instantiating BcryptPasswordHasher...')
const passwordHasher = new BcryptPasswordHasher()
console.log('Instantiating CreateUserUseCase...')
const createUserUseCase = new CreateUserUseCase(userRepository, passwordHasher)
console.log('Instantiating AuthenticateUserUseCase...')
const authenticateUserUseCase = new AuthenticateUserUseCase(userRepository, passwordHasher)
console.log('Instantiating GetUserProfileUseCase...')
const getUserProfileUseCase = new GetUserProfileUseCase(userRepository)

console.log('Instantiating UserController...')
const userController = new UserController(
  createUserUseCase,
  authenticateUserUseCase,
  getUserProfileUseCase,
)

userRoutes.post('/register', zValidator('json', UserRegisterSchema), (c) =>
  userController.createUser(c),
)
userRoutes.post('/login', zValidator('json', UserLoginSchema), (c) =>
  userController.authenticateUser(c),
)
userRoutes.get('/profile/:id', (c) => userController.getUserProfile(c))

console.log('UserRoutes initialized.')

export default userRoutes
