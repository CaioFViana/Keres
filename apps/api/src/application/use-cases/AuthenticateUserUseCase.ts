import type { IUserRepository } from '@domain/repositories/IUserRepository'
import type { IPasswordHasherService } from '@domain/services/IPasswordHasherService'
import type { UserLoginPayload, UserProfileResponse } from '@keres/shared'

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasherService,
  ) {}

  async execute(data: UserLoginPayload): Promise<UserProfileResponse | null> {
    const user = await this.userRepository.findByUsername(data.username)
    if (!user) {
      return null // User not found
    }

    const isPasswordValid = await this.passwordHasher.compare(data.password, user.passwordHash)
    if (!isPasswordValid) {
      return null // Invalid password
    }

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
