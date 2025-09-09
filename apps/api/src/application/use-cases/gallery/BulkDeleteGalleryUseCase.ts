import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { INoteRepository } from '@domain/repositories/INoteRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

export class BulkDeleteGalleryUseCase {
  constructor(
    private readonly galleryRepository: IGalleryRepository,
    private readonly storyRepository: IStoryRepository,
    private readonly noteRepository: INoteRepository,
  ) {}

  async execute(
    userId: string,
    ids: string[],
  ): Promise<{ successfulIds: string[]; failedIds: { id: string; reason: string }[] }> {
    const successfulIds: string[] = []
    const failedIds: { id: string; reason: string }[] = []

    for (const id of ids) {
      try {
        const existingGallery = await this.galleryRepository.findById(id)
        if (!existingGallery) {
          failedIds.push({ id, reason: 'Gallery item not found' })
          continue
        }

        const story = await this.storyRepository.findById(existingGallery.storyId, userId)
        if (!story) {
          failedIds.push({ id, reason: 'Story not found or not owned by user' })
          continue
        }

        const notes = await this.noteRepository.findByGalleryId(id)
        if (notes && notes.length > 0) {
          failedIds.push({
            id,
            reason: 'Gallery item cannot be deleted because it is referenced by notes.',
          })
          continue
        }

        await this.galleryRepository.delete(id, existingGallery.storyId, existingGallery.ownerId)
        successfulIds.push(id)
      } catch (error: any) {
        failedIds.push({ id, reason: error.message || 'Unknown error' })
      }
    }

    return { successfulIds, failedIds }
  }
}
