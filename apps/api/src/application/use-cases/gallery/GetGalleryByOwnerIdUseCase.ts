import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Import
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Import
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Import
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import
import type { GalleryResponse, ListQueryParams, PaginatedResponse } from '@keres/shared' // Import PaginatedResponse

export class GetGalleryByOwnerIdUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly characterRepository: ICharacterRepository, // Inject
    private readonly noteRepository: INoteRepository, // Inject
    private readonly locationRepository: ILocationRepository, // Inject
    private readonly storyRepository: IStoryRepository, // Inject
  ) {}

  async execute(
    userId: string,
    ownerId: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<GalleryResponse>> {
    const paginatedGalleryItems = await this.galleryRepository.findByOwnerId(ownerId, userId, query)

    const items = paginatedGalleryItems.items.map((item) => ({
      id: item.id,
      storyId: item.storyId,
      ownerId: item.ownerId,
      ownerType: item.ownerType,
      imagePath: item.imagePath,
      isFile: item.isFile,
      isFavorite: item.isFavorite,
      extraNotes: item.extraNotes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    return {
      items,
      totalItems: paginatedGalleryItems.totalItems,
    }
  }
}
