import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { IUserRepository } from '@domain/repositories/IUserRepository'
import { DeleteStoryUseCase } from '@application/use-cases/story'

export class DeleteUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly deleteStoryUseCase: DeleteStoryUseCase, // Inject DeleteStoryUseCase
  ) {}

  async execute(userId: string): Promise<void> {
    const stories = await this.storyRepository.findByUserId(userId)
    if (stories && stories.items.length > 0) {
      for (const story of stories.items) {
        await this.deleteStoryUseCase.execute(userId, story.id)
      }
    }

    await this.userRepository.delete(userId)
  }
}
