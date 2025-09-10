import type { Gallery } from '@domain/entities/Gallery'
import type { ListQueryParams, PaginatedResponse } from '@keres/shared'

export interface IGalleryRepository {
  findById(id: string): Promise<Gallery | null>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<PaginatedResponse<Gallery>>
  findByOwnerId(ownerId: string, userId: string, query?: ListQueryParams): Promise<PaginatedResponse<Gallery>>
  findByImagePathAndStoryId(imagePath: string, storyId: string): Promise<Gallery | null>
  save(gallery: Gallery): Promise<void>
  update(gallery: Gallery, storyId: string, ownerId: string): Promise<void>
  delete(id: string, storyId: string, ownerId: string): Promise<void>
}
