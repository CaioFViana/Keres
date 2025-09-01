import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { NoteResponse, UpdateNotePayload } from '@keres/shared'

export class UpdateNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(data: UpdateNotePayload): Promise<NoteResponse | null> {
    const existingNote = await this.noteRepository.findById(data.id)
    if (!existingNote) {
      return null // Note not found
    }

    const updatedNote = {
      ...existingNote,
      ...data,
      updatedAt: new Date(),
    }

    await this.noteRepository.update(updatedNote)

    return {
      id: updatedNote.id,
      storyId: updatedNote.storyId,
      title: updatedNote.title,
      body: updatedNote.body,
      galleryId: updatedNote.galleryId,
      isFavorite: updatedNote.isFavorite,
      extraNotes: updatedNote.extraNotes,
      createdAt: updatedNote.createdAt,
      updatedAt: updatedNote.updatedAt,
    }
  }
}
