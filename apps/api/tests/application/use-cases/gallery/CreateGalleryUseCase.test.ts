import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Added
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Added
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added

import { CreateGalleryUseCase } from '@application/use-cases/gallery/CreateGalleryUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

// Mock implementations
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

// Mock for IStoryRepository
const mockStoryRepository = {
  findById: vi.fn(),
}

// Mock for ICharacterRepository
const mockCharacterRepository = {
  findById: vi.fn(),
}

// Mock for INoteRepository
const mockNoteRepository = {
  findById: vi.fn(),
}

// Mock for ILocationRepository
const mockLocationRepository = {
  findById: vi.fn(),
}

describe('CreateGalleryUseCase', () => {
  let galleryRepository: MockGalleryRepository
  let createGalleryUseCase: CreateGalleryUseCase

  beforeEach(() => {
    galleryRepository = new MockGalleryRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockStoryRepository.findById.mockResolvedValue({ id: 'story123', userId: 'user123', type: 'linear' }) // Default story for tests
    mockCharacterRepository.findById.mockImplementation((id: string) => {
      if (id === 'char123') return { id: 'char123', storyId: 'story123' }
      return null
    })
    mockNoteRepository.findById.mockImplementation((id: string) => {
      if (id === 'note123') return { id: 'note123', storyId: 'story123' }
      return null
    })
    mockLocationRepository.findById.mockImplementation((id: string) => {
      if (id === 'loc123') return { id: 'loc123', storyId: 'story123' }
      return null
    })


    createGalleryUseCase = new CreateGalleryUseCase(
      galleryRepository,
      mockStoryRepository,
      mockCharacterRepository,
      mockNoteRepository,
      mockLocationRepository,
    )
  })

  it('should create a new gallery item successfully with a character owner', async () => {
    const galleryDTO = {
      storyId: 'story123',
      ownerId: 'char123',
      imagePath: 'http://example.com/image.jpg',
      isFile: false,
      isFavorite: true,
      extraNotes: 'Some notes.',
    }

    const galleryProfile = await createGalleryUseCase.execute('user123', galleryDTO) // Pass userId

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

  it('should create a new gallery item successfully with a note owner', async () => {
    const galleryDTO = {
      storyId: 'story123',
      ownerId: 'note123',
      imagePath: 'http://example.com/image_note.jpg',
    }

    const galleryProfile = await createGalleryUseCase.execute('user123', galleryDTO) // Pass userId

    expect(galleryProfile).toBeDefined()
    expect(galleryProfile.imagePath).toBe('http://example.com/image_note.jpg')
    expect(galleryProfile.ownerId).toBe('note123')
  })

  it('should create a new gallery item successfully with a location owner', async () => {
    const galleryDTO = {
      storyId: 'story123',
      ownerId: 'loc123',
      imagePath: 'http://example.com/image_loc.jpg',
    }

    const galleryProfile = await createGalleryUseCase.execute('user123', galleryDTO) // Pass userId

    expect(galleryProfile).toBeDefined()
    expect(galleryProfile.imagePath).toBe('http://example.com/image_loc.jpg')
    expect(galleryProfile.ownerId).toBe('loc123')
  })

  it('should throw an error if story not found or not owned by user', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    const galleryDTO = {
      storyId: 'nonexistent_story',
      ownerId: 'char123',
      imagePath: 'http://example.com/image.jpg',
    }

    await expect(createGalleryUseCase.execute('user123', galleryDTO)).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })

  it('should throw an error if owner not found or does not belong to the specified story', async () => {
    // Mock all owner repositories to return null for a specific ID
    mockCharacterRepository.findById.mockResolvedValue(null)
    mockNoteRepository.findById.mockResolvedValue(null)
    mockLocationRepository.findById.mockResolvedValue(null)

    const galleryDTO = {
      storyId: 'story123',
      ownerId: 'nonexistent_owner',
      imagePath: 'http://example.com/image.jpg',
    }

    await expect(createGalleryUseCase.execute('user123', galleryDTO)).rejects.toThrow(
      'Owner not found or does not belong to the specified story',
    )
  })

  it('should create a new gallery item without an owner', async () => {
    const galleryDTO = {
      storyId: 'story123',
      imagePath: 'http://example.com/no_owner.jpg',
    }

    const galleryProfile = await createGalleryUseCase.execute('user123', galleryDTO)

    expect(galleryProfile).toBeDefined()
    expect(galleryProfile.imagePath).toBe('http://example.com/no_owner.jpg')
    expect(galleryProfile.ownerId).toBeNull()
  })
})
