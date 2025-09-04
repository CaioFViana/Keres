import type { Note } from '@domain/entities/Note'
import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { CreateNotePayload, NoteResponse } from '@keres/shared'

import { ulid } from 'ulid'

export class CreateNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: CreateNotePayload): Promise<NoteResponse> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(data.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const newNote: Note = {
      id: ulid(),
      storyId: data.storyId,
      title: data.title,
      body: data.body || null,
      galleryId: data.galleryId || null,
      isFavorite: data.isFavorite || false,
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
      createdAt: newNote.createdAt,
      updatedAt: newNote.updatedAt,
    }
  }
}
