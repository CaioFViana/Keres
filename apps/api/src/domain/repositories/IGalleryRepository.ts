import type { Gallery } from '@domain/entities/Gallery'
import type { ListQueryParams } from '@keres/shared'

export interface IGalleryRepository {
  findById(id: string): Promise<Gallery | null>
  findByStoryId(storyId: string, query?: ListQueryParams): Promise<Gallery[]>
  findByOwnerId(ownerId: string, userId: string, query?: ListQueryParams): Promise<Gallery[]>
  save(gallery: Gallery): Promise<void>
  update(gallery: Gallery, storyId: string, ownerId: string): Promise<void>
  delete(id: string, storyId: string, ownerId: string): Promise<void>
}
