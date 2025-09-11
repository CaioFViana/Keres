import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Import IStoryRepository
import type { GalleryResponse, ListQueryParams, PaginatedResponse } from 'schemas'

export class GetGalleryByStoryIdUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository, // Inject IStoryRepository
  ) {}

  async execute(
    userId: string,
    storyId: string,
    query: ListQueryParams,
  ): Promise<PaginatedResponse<GalleryResponse>> {
    // Verify that the story exists and belongs to the user
    const story = await this.storyRepository.findById(storyId, userId)
    if (!story) {
      throw new Error('Story not found or not owned by user')
    }

    const paginatedGalleryItems = await this.galleryRepository.findByStoryId(storyId, query)
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
