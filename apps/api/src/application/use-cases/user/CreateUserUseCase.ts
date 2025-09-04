import type { User } from '@domain/entities/User'
import type { IUserRepository } from '@domain/repositories/IUserRepository'
import type { IPasswordHasherService } from '@domain/services/IPasswordHasherService'
import type { UserProfileResponse, UserRegisterPayload } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasherService,
  ) {}

  async execute(data: UserRegisterPayload): Promise<UserProfileResponse> {
    const existingUser = await this.userRepository.findByUsername(data.username)
    if (existingUser) {
      throw new Error('Username already exists')
    }

    const generatedSalt = await this.passwordHasher.generateSalt()
    const passwordHash = await this.passwordHasher.hash(data.password, generatedSalt)
    const passwordSalt = generatedSalt // Use the generated salt

    const newUser: User = {
      id: ulid(),
      username: data.username,
      passwordHash,
      passwordSalt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.userRepository.save(newUser)

    return {
      id: newUser.id,
      username: newUser.username,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    }
  }
}
