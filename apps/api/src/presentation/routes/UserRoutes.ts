import { Hono } from 'hono';
import { UserController } from '@presentation/controllers/UserController';
import { CreateUserUseCase, AuthenticateUserUseCase, GetUserProfileUseCase } from '@application/use-cases';
import { UserRepository } from '@infrastructure/persistence/UserRepository';
import { BcryptPasswordHasher } from '@infrastructure/services/BcryptPasswordHasher';
import { db } from '@keres/db';

console.log('Initializing UserRoutes...');

const userRoutes = new Hono();

// Dependencies for UserController
console.log('Instantiating UserRepository...');
const userRepository = new UserRepository();
console.log('Instantiating BcryptPasswordHasher...');
const passwordHasher = new BcryptPasswordHasher();
console.log('Instantiating CreateUserUseCase...');
const createUserUseCase = new CreateUserUseCase(userRepository, passwordHasher);
console.log('Instantiating AuthenticateUserUseCase...');
const authenticateUserUseCase = new AuthenticateUserUseCase(userRepository, passwordHasher);
console.log('Instantiating GetUserProfileUseCase...');
const getUserProfileUseCase = new GetUserProfileUseCase(userRepository);

console.log('Instantiating UserController...');
const userController = new UserController(
  createUserUseCase,
  authenticateUserUseCase,
  getUserProfileUseCase
);

userRoutes.post('/register', (c) => userController.createUser(c));
userRoutes.post('/login', (c) => userController.authenticateUser(c));
userRoutes.get('/profile/:id', (c) => userController.getUserProfile(c));

console.log('UserRoutes initialized.');

export default userRoutes;