import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository' // Added
import type { NoteResponse, UpdateNotePayload } from '@keres/shared'

export class UpdateNoteUseCase {
  constructor(
    private readonly noteRepository: INoteRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
    private readonly galleryRepository: IGalleryRepository, // Added
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

    // Validate galleryId if provided in the update payload
    if (data.galleryId) {
      const gallery = await this.galleryRepository.findById(data.galleryId)
      if (!gallery) {
        throw new Error('Gallery item not found')
      }
      if (gallery.storyId !== existingNote.storyId) {
        throw new Error('Gallery item does not belong to the specified story')
      }
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
