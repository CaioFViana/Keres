import type { Gallery } from '@domain/entities/Gallery'

export interface IGalleryRepository {
  findById(id: string): Promise<Gallery | null>
  findByStoryId(storyId: string): Promise<Gallery[]>
  findByOwnerId(ownerId: string): Promise<Gallery[]>
  save(gallery: Gallery): Promise<void>
  update(gallery: Gallery, storyId: string, ownerId: string): Promise<void>
  delete(id: string, storyId: string, ownerId: string): Promise<void>
}
