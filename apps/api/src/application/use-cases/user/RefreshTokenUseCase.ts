import type { IUserRepository } from '@domain/repositories/IUserRepository'
import type { IJwtService } from '@domain/services/IJwtService'

export class RefreshTokenUseCase {
  constructor(
    private readonly jwtService: IJwtService,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(refreshToken: string): Promise<{ token: string } | null> {
    const decodedRefreshToken = await this.jwtService.verifyRefreshToken(refreshToken)

    if (
      !decodedRefreshToken ||
      typeof decodedRefreshToken !== 'object' ||
      !('userId' in decodedRefreshToken)
    ) {
      return null // Invalid refresh token
    }

    const userId = decodedRefreshToken.userId as string
    const user = await this.userRepository.findById(userId)

    if (!user) {
      return null // User not found
    }

    // Generate a new access token
    const newAccessToken = await this.jwtService.generateToken(
      { userId: user.id, username: user.username },
      '1h',
    )

    return { token: newAccessToken }
  }
}
