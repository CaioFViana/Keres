import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { IUserRepository } from '@domain/repositories/IUserRepository'

export class DeleteUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly storyRepository: IStoryRepository,
  ) {}

  async execute(userId: string): Promise<void> {
    const stories = await this.storyRepository.findByUserId(userId)
    if (stories && stories.length > 0) {
      throw new Error('User cannot be deleted because they own stories.')
    }

    await this.userRepository.delete(userId)
  }
}
