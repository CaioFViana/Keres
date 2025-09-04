import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { NoteResponse, UpdateNotePayload } from '@keres/shared'

export class UpdateNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(userId: string, data: UpdateNotePayload): Promise<NoteResponse> {
    const existingNote = await this.noteRepository.findById(data.id)
    if (!existingNote) {
      throw new Error('Note not found')
    }

    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(existingNote.storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const updatedNote = {
      ...existingNote,
      ...data,
      updatedAt: new Date(),
    }

    await this.noteRepository.update(updatedNote, existingNote.storyId)

    return {
      id: updatedNote.id,
      storyId: updatedNote.storyId,
      title: updatedNote.title,
      body: updatedNote.body,
      galleryId: updatedNote.galleryId,
      isFavorite: updatedNote.isFavorite,
      createdAt: updatedNote.createdAt,
      updatedAt: updatedNote.updatedAt,
    }
  }
}
