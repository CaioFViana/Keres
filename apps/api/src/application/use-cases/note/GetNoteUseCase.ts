import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { NoteResponse } from '@keres/shared'

export class GetNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, id: string): Promise<NoteResponse> {
    const note = await this.noteRepository.findById(id)
    if (!note) {
      throw new Error('Note not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(note.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    return {
      id: note.id,
      storyId: note.storyId,
      title: note.title,
      body: note.body,
      galleryId: note.galleryId,
      isFavorite: note.isFavorite,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }
  }
}
