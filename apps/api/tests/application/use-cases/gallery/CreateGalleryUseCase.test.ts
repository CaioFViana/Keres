import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'

import { CreateGalleryUseCase } from '@application/use-cases/gallery/CreateGalleryUseCase'
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

describe('CreateGalleryUseCase', () => {
  let galleryRepository: MockGalleryRepository
  let createGalleryUseCase: CreateGalleryUseCase

  beforeEach(() => {
    galleryRepository = new MockGalleryRepository()
    createGalleryUseCase = new CreateGalleryUseCase(galleryRepository)
  })

  it('should create a new gallery item successfully', async () => {
    const galleryDTO = {
      storyId: 'story123',
      ownerId: 'char123',
      imagePath: 'http://example.com/image.jpg',
      isFile: false,
      isFavorite: true,
      extraNotes: 'Some notes.',
    }

    const galleryProfile = await createGalleryUseCase.execute(galleryDTO)

    expect(galleryProfile).toBeDefined()
    expect(galleryProfile.imagePath).toBe('http://example.com/image.jpg')
    expect(galleryProfile.storyId).toBe('story123')
    expect(galleryProfile.ownerId).toBe('char123')
    expect(galleryProfile.id).toBeDefined()
    expect(galleryProfile.isFavorite).toBe(true)

    const createdGallery = await galleryRepository.findById(galleryProfile.id)
    expect(createdGallery).toBeDefined()
    expect(createdGallery?.imagePath).toBe('http://example.com/image.jpg')
  })

  it('should create a new gallery item with default values for optional fields', async () => {
    const galleryDTO = {
      storyId: 'story456',
      ownerId: 'loc456',
      imagePath: 'http://example.com/another.png',
    }

    const galleryProfile = await createGalleryUseCase.execute(galleryDTO)

    expect(galleryProfile).toBeDefined()
    expect(galleryProfile.imagePath).toBe('http://example.com/another.png')
    expect(galleryProfile.isFile).toBe(false)
    expect(galleryProfile.isFavorite).toBe(false)
    expect(galleryProfile.extraNotes).toBeNull()
  })
})
