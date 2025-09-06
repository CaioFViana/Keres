import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { ListQueryParams, NoteResponse } from '@keres/shared'

export class GetNotesByStoryIdUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, storyId: string, query: ListQueryParams): Promise<NoteResponse[]> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const notes = await this.noteRepository.findByStoryId(storyId, query)
    return notes.map((note) => ({
      id: note.id,
      storyId: note.storyId,
      title: note.title,
      body: note.body,
      galleryId: note.galleryId,
      isFavorite: note.isFavorite,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }))
  }
}
