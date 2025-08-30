import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'

import { GetGalleryUseCase } from '@application/use-cases/GetGalleryUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

// Mock implementation
class MockGalleryRepository implements IGalleryRepository {
  private galleryItems: Gallery[] = []

  async findById(id: string): Promise<Gallery | null> {
    return this.galleryItems.find((item) => item.id === id) || null
  }

  async findByStoryId(storyId: string): Promise<Gallery[]> {
    return this.galleryItems.filter((item) => item.storyId === storyId)
  }

  async findByOwnerId(ownerId: string): Promise<Gallery[]> {
    return this.galleryItems.filter((item) => item.ownerId === ownerId)
  }

  async save(gallery: Gallery): Promise<void> {
    this.galleryItems.push(gallery)
  }

  async update(gallery: Gallery): Promise<void> {
    const index = this.galleryItems.findIndex((item) => item.id === gallery.id)
    if (index !== -1) {
      this.galleryItems[index] = gallery
    }
  }

  async delete(id: string): Promise<void> {
    this.galleryItems = this.galleryItems.filter((item) => item.id !== id)
  }
}

describe('GetGalleryUseCase', () => {
  let galleryRepository: MockGalleryRepository
  let getGalleryUseCase: GetGalleryUseCase

  beforeEach(() => {
    galleryRepository = new MockGalleryRepository()
    getGalleryUseCase = new GetGalleryUseCase(galleryRepository)

    // Pre-populate a gallery item for testing
    galleryRepository.save({
      id: 'gallery123',
      storyId: 'story123',
      ownerId: 'char123',
      imagePath: 'http://example.com/test.jpg',
      isFile: false,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should return a gallery item profile for a valid ID', async () => {
    const galleryProfile = await getGalleryUseCase.execute('gallery123')

    expect(galleryProfile).toBeDefined()
    expect(galleryProfile?.id).toBe('gallery123')
    expect(galleryProfile?.imagePath).toBe('http://example.com/test.jpg')
  })

  it('should return null for an invalid gallery ID', async () => {
    const galleryProfile = await getGalleryUseCase.execute('nonexistent')

    expect(galleryProfile).toBeNull()
  })
})
