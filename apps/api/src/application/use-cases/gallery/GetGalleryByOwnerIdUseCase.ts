import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { GalleryResponse, ListQueryParams, PaginatedResponse } from '@keres/shared' // Import PaginatedResponse

export class GetGalleryByOwnerIdUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
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
