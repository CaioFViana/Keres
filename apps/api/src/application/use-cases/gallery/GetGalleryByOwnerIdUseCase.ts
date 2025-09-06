import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Import
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Import
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import
import type { GalleryResponse } from '@keres/shared'

export class GetGalleryByOwnerIdUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly characterRepository: ICharacterRepository, // Inject
    private readonly noteRepository: INoteRepository, // Inject
    private readonly locationRepository: ILocationRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(userId: string, ownerId: string): Promise<GalleryResponse[]> {
    const galleryItems = await this.galleryRepository.findByOwnerId(ownerId)
    const ownedGalleryItems: GalleryResponse[] = []

    for (const item of galleryItems) {
      let storyId: string | null = null

      // Try to find owner in Character, Note, or Location
      const character = await this.characterRepository.findById(ownerId)
      if (character) {
        storyId = character.storyId
      } else {
        const note = await this.noteRepository.findById(ownerId)
        if (note) {
          storyId = note.storyId
        } else {
          const location = await this.locationRepository.findById(ownerId)
          if (location) {
            storyId = location.storyId
          }
        }
      }

      if (storyId) {
        // Verify that the story exists and belongs to the user
        const story = await this.storyRepository.findById(storyId, userId)
        if (story) {
          ownedGalleryItems.push({
            id: item.id,
            storyId: item.storyId,
            ownerId: item.ownerId,
            imagePath: item.imagePath,
            isFile: item.isFile,
            isFavorite: item.isFavorite,
            extraNotes: item.extraNotes,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })
        }
      }
    }

    return ownedGalleryItems
  }
}
