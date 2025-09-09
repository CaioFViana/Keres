import type {
  AuthenticateUserUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  GetUserProfileUseCase,
} from '@application/use-cases'
import type z from 'zod'

import { type UserLoginSchema, UserProfileSchema, type UserRegisterSchema } from '@keres/shared'

export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
  ) {}

  async createUser(data: z.infer<typeof UserRegisterSchema>) {
    const userProfile = await this.createUserUseCase.execute(data)
    return UserProfileSchema.parse(userProfile)
  }

  async authenticateUser(data: z.infer<typeof UserLoginSchema>) {
    const userProfile = await this.authenticateUserUseCase.execute(data)
    if (!userProfile) {
      throw new Error('Invalid credentials')
    }
    return UserProfileSchema.parse(userProfile)
  }

  async getUserProfile(id: string) {
    const userProfile = await this.getUserProfileUseCase.execute(id)
    if (!userProfile) {
      throw new Error('User not found')
    }
    return UserProfileSchema.parse(userProfile)
  }

  async deleteUser(id: string) {
    await this.deleteUserUseCase.execute(id)
    return { message: 'User deleted successfully' }
  }
}
