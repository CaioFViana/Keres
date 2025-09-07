import type { IUserRepository } from '@domain/repositories/IUserRepository'
import type { IJwtService } from '@domain/services/IJwtService' // Added
import type { IPasswordHasherService } from '@domain/services/IPasswordHasherService'
import type { UserLoginPayload, UserProfileResponse } from '@keres/shared'

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasherService,
    private readonly jwtService: IJwtService, // Added
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

    const token = await this.jwtService.generateToken(
      { userId: user.id, username: user.username },
      '1h',
    )
    const refreshToken = await this.jwtService.generateRefreshToken(
      { userId: user.id },
      '7d',
    )

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      token,
      refreshToken,
    }
  }
}
