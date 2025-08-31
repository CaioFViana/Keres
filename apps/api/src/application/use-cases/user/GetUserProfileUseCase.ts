import type { IUserRepository } from '@domain/repositories/IUserRepository'
import type { UserProfileResponse } from '@keres/shared'

export class GetUserProfileUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string): Promise<UserProfileResponse | null> {
    const user = await this.userRepository.findById(userId)
    if (!user) {
      return null
    }

    return {
      id: user.id,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  }
}
