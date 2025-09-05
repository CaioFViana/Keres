import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'

import { DeleteGalleryUseCase } from '@application/use-cases/gallery/DeleteGalleryUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock for IStoryRepository
const mockStoryRepository = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

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

  async delete(id: string, storyId: string, ownerId: string): Promise<void> {
    this.galleryItems = this.galleryItems.filter((item) => item.id !== id || item.storyId !== storyId || item.ownerId !== ownerId)
  }
}

describe('DeleteGalleryUseCase', () => {
  let galleryRepository: MockGalleryRepository
  let deleteGalleryUseCase: DeleteGalleryUseCase

  beforeEach(() => {
    galleryRepository = new MockGalleryRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockImplementation((id: string, userId: string) => {
      if (id === 'story123' && userId === 'user123') {
        return Promise.resolve({ id: 'story123', userId: 'user123', title: 'Test Story 1', type: 'linear' })
      }
      if (id === 'another_story' && userId === 'user123') {
        return Promise.resolve({ id: 'another_story', userId: 'user123', title: 'Test Story 2', type: 'linear' })
      }
      return Promise.resolve(null)
    })

    deleteGalleryUseCase = new DeleteGalleryUseCase(galleryRepository, mockStoryRepository)

    // Pre-populate a gallery item for testing
    galleryRepository.save({
      id: 'gal123',
      storyId: 'story123',
      ownerId: 'char123',
      imagePath: 'http://example.com/image.jpg',
      isFile: false,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should delete an existing gallery item successfully', async () => {
    const deleted = await deleteGalleryUseCase.execute('user123', 'gal123', 'story123', 'char123')
    expect(deleted).toBe(true)

    const gallery = await galleryRepository.findById('gal123')
    expect(gallery).toBeNull()
  })

  it('should return false if gallery item not found', async () => {
    await expect(deleteGalleryUseCase.execute('user123', 'nonexistent_gal', 'story123', 'char123')).rejects.toThrow('Gallery item not found')
  })

  it('should return false if gallery item does not belong to the specified story', async () => {
    await expect(deleteGalleryUseCase.execute('user123', 'gal123', 'another_story', 'char123')).rejects.toThrow('Gallery item not found or does not belong to the specified story')

    // Ensure the gallery item was not deleted
    const gallery = await galleryRepository.findById('gal123')
    expect(gallery).toBeDefined()
  })
})
