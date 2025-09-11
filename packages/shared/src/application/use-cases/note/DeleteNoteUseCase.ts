import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository

export class DeleteNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<boolean> {
    const existingNote = await this.noteRepository.findById(id)
    if (!existingNote) {
      throw new Error('Note not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingNote.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    await this.noteRepository.delete(id, existingNote.storyId)
    return true
  }
}
