import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'

import { GetGalleryByStoryIdUseCase } from '@application/use-cases/gallery/GetGalleryByStoryIdUseCase'
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

  async delete(id: string): Promise<void> {
    this.galleryItems = this.galleryItems.filter((item) => item.id !== id)
  }
}

describe('GetGalleryByStoryIdUseCase', () => {
  let galleryRepository: MockGalleryRepository
  let getGalleryByStoryIdUseCase: GetGalleryByStoryIdUseCase

  beforeEach(() => {
    galleryRepository = new MockGalleryRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockImplementation((id: string, userId: string) => {
      if (id === 'story123' && userId === 'user123') {
        return Promise.resolve({
          id: 'story123',
          userId: 'user123',
          title: 'Test Story 1',
          type: 'linear',
        })
      }
      if (id === 'story456' && userId === 'user123') {
        return Promise.resolve({
          id: 'story456',
          userId: 'user123',
          title: 'Test Story 2',
          type: 'linear',
        })
      }
      return Promise.resolve(null)
    })

    getGalleryByStoryIdUseCase = new GetGalleryByStoryIdUseCase(
      galleryRepository,
      mockStoryRepository,
    )

    // Pre-populate gallery items for testing
    galleryRepository.save({
      id: 'gal1',
      storyId: 'story123',
      ownerId: 'char1',
      imagePath: 'path/to/image1.jpg',
      isFile: false,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    galleryRepository.save({
      id: 'gal2',
      storyId: 'story123',
      ownerId: 'loc1',
      imagePath: 'path/to/image2.png',
      isFile: false,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    galleryRepository.save({
      id: 'gal3',
      storyId: 'story456',
      ownerId: 'char2',
      imagePath: 'path/to/image3.gif',
      isFile: false,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should return all gallery items for a given story ID', async () => {
    const galleryItems = await getGalleryByStoryIdUseCase.execute('user123', 'story123')

    expect(galleryItems).toBeDefined()
    expect(galleryItems.length).toBe(2)
    expect(galleryItems[0].imagePath).toBe('path/to/image1.jpg')
    expect(galleryItems[1].imagePath).toBe('path/to/image2.png')
  })

  it('should return an empty array if no gallery items found for the story ID', async () => {
    await expect(
      getGalleryByStoryIdUseCase.execute('user123', 'nonexistent_story'),
    ).rejects.toThrow('Story not found or not owned by user')
  })
})
