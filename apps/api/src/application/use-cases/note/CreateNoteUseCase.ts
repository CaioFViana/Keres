import type { Note } from '@domain/entities/Note'
import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { CreateNotePayload, NoteResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateNoteUseCase {
  constructor(private readonly noteRepository: INoteRepository) {}

  async execute(data: CreateNotePayload): Promise<NoteResponse> {
    const newNote: Note = {
      id: ulid(),
      storyId: data.storyId,
      title: data.title,
      body: data.body || null,
      galleryId: data.galleryId || null,
      isFavorite: data.isFavorite || false,
      extraNotes: data.extraNotes || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await this.noteRepository.save(newNote)

    return {
      id: newNote.id,
      storyId: newNote.storyId,
      title: newNote.title,
      body: newNote.body,
      galleryId: newNote.galleryId,
      isFavorite: newNote.isFavorite,
      extraNotes: newNote.extraNotes,
      createdAt: newNote.createdAt,
      updatedAt: newNote.updatedAt,
    }
  }
}
