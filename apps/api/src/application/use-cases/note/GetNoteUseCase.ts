import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { NoteResponse } from '@keres/shared'

export class GetNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(id: string): Promise<NoteResponse | null> {
    const note = await this.noteRepository.findById(id)
    if (!note) {
      return null
    }

    return {
      id: note.id,
      storyId: note.storyId,
      title: note.title,
      body: note.body,
      galleryId: note.galleryId,
      isFavorite: note.isFavorite,
      extraNotes: note.extraNotes,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }
  }
}
