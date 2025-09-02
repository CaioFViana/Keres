import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { NoteResponse } from '@keres/shared'

export class GetNotesByStoryIdUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(storyId: string): Promise<NoteResponse[]> {
    const notes = await this.noteRepository.findByStoryId(storyId)
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
