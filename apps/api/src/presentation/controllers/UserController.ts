import { Context } from 'hono';
import { CreateUserUseCase, AuthenticateUserUseCase, GetUserProfileUseCase } from '@application/use-cases';
import { createUserSchema, authenticateUserSchema, userProfileSchema } from '@presentation/schemas/UserSchemas';

export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase
  ) {}

  async createUser(c: Context) {
    const body = await c.req.json();
    const validation = createUserSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const userProfile = await this.createUserUseCase.execute(validation.data);
      return c.json(userProfileSchema.parse(userProfile), 201);
    } catch (error: any) {
      if (error.message === 'Username already exists') {
        return c.json({ error: error.message }, 409);
      }
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async authenticateUser(c: Context) {
    const body = await c.req.json();
    const validation = authenticateUserSchema.safeParse(body);

    if (!validation.success) {
      return c.json({ error: validation.error.errors }, 400);
    }

    try {
      const userProfile = await this.authenticateUserUseCase.execute(validation.data);
      if (!userProfile) {
        return c.json({ error: 'Invalid credentials' }, 401);
      }
      return c.json(userProfileSchema.parse(userProfile), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }

  async getUserProfile(c: Context) {
    // In a real application, the user ID would come from authentication middleware
    // For now, let's assume it's passed as a param or hardcoded for testing
    const userId = c.req.param('id'); 

    try {
      const userProfile = await this.getUserProfileUseCase.execute(userId);
      if (!userProfile) {
        return c.json({ error: 'User not found' }, 404);
      }
      return c.json(userProfileSchema.parse(userProfile), 200);
    } catch (error) {
      return c.json({ error: 'Internal Server Error' }, 500);
    }
  }
}
