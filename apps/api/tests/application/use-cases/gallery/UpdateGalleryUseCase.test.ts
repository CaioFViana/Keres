import type { Gallery } from '@domain/entities/Gallery'
import type { IGalleryRepository } from '@domain/repositories/IGalleryRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added
import type { ICharacterRepository } from '@domain/repositories/ICharacterRepository' // Added
import type { INoteRepository } from '@domain/repositories/INoteRepository' // Added
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added

import { UpdateGalleryUseCase } from '@application/use-cases/gallery/UpdateGalleryUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

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

describe('UpdateGalleryUseCase', () => {
  let galleryRepository: MockGalleryRepository
  let updateGalleryUseCase: UpdateGalleryUseCase

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
      if (id === 'note123') return { id: 'note123', storyId: 'story123', galleryId: 'gal123' } // Added galleryId for note
      return null
    })
    mockLocationRepository.findById.mockImplementation((id: string) => {
      if (id === 'loc123') return { id: 'loc123', storyId: 'story123' }
      return null
    })

    updateGalleryUseCase = new UpdateGalleryUseCase(
      galleryRepository,
      mockStoryRepository,
      mockCharacterRepository,
      mockNoteRepository,
      mockLocationRepository,
    )

    // Pre-populate a gallery item for testing
    galleryRepository.save({
      id: 'gal123',
      storyId: 'story123',
      ownerId: 'char123',
      imagePath: 'http://example.com/original.jpg',
      isFile: false,
      isFavorite: false,
      extraNotes: 'Original Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should update an existing gallery item successfully', async () => {
    const updateDTO = {
      id: 'gal123',
      imagePath: 'http://example.com/updated.jpg',
      isFavorite: true,
    }

    const updatedGallery = await updateGalleryUseCase.execute('user123', updateDTO) // Pass userId

    expect(updatedGallery).toBeDefined()
    expect(updatedGallery?.imagePath).toBe('http://example.com/updated.jpg')
    expect(updatedGallery?.isFavorite).toBe(true)
    expect(updatedGallery?.extraNotes).toBe('Original Notes') // Should remain unchanged
  })

  it('should update an existing gallery item with a new character owner', async () => {
    const updateDTO = {
      id: 'gal123',
      ownerId: 'char123', // Same owner, but testing the path
      imagePath: 'http://example.com/updated_char.jpg',
    }

    const updatedGallery = await updateGalleryUseCase.execute('user123', updateDTO)

    expect(updatedGallery).toBeDefined()
    expect(updatedGallery?.imagePath).toBe('http://example.com/updated_char.jpg')
    expect(updatedGallery?.ownerId).toBe('char123')
  })

  it('should update an existing gallery item with a new note owner', async () => {
    const updateDTO = {
      id: 'gal123',
      ownerId: 'note123',
      imagePath: 'http://example.com/updated_note.jpg',
    }

    const updatedGallery = await updateGalleryUseCase.execute('user123', updateDTO)

    expect(updatedGallery).toBeDefined()
    expect(updatedGallery?.imagePath).toBe('http://example.com/updated_note.jpg')
    expect(updatedGallery?.ownerId).toBe('note123')
  })

  it('should update an existing gallery item with a new location owner', async () => {
    const updateDTO = {
      id: 'gal123',
      ownerId: 'loc123',
      imagePath: 'http://example.com/updated_loc.jpg',
    }

    const updatedGallery = await updateGalleryUseCase.execute('user123', updateDTO)

    expect(updatedGallery).toBeDefined()
    expect(updatedGallery?.imagePath).toBe('http://example.com/updated_loc.jpg')
    expect(updatedGallery?.ownerId).toBe('loc123')
  })

  it('should throw an error if owner not found or does not belong to the specified story during update', async () => {
    // Mock all owner repositories to return null for a specific ID
    mockCharacterRepository.findById.mockResolvedValue(null)
    mockNoteRepository.findById.mockResolvedValue(null)
    mockLocationRepository.findById.mockResolvedValue(null)

    const updateDTO = {
      id: 'gal123',
      ownerId: 'nonexistent_owner',
      imagePath: 'http://example.com/new.jpg',
    }

    await expect(updateGalleryUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Owner not found or does not belong to the specified story',
    )
  })

  it('should return null if gallery item not found', async () => {
    const updateDTO = {
      id: 'nonexistent_gal',
      imagePath: 'http://example.com/new.jpg',
    }

    const updatedGallery = await updateGalleryUseCase.execute('user123', updateDTO) // Pass userId

    expect(updatedGallery).toBeNull()
  })

  it('should return null if gallery item does not belong to the specified story', async () => {
    // Mock story to return a story not owned by the user
    mockStoryRepository.findById.mockResolvedValue({ id: 'another_story', userId: 'another_user', type: 'linear' })

    const updateDTO = {
      id: 'gal123',
      imagePath: 'http://example.com/new.jpg',
    }

    const updatedGallery = await updateGalleryUseCase.execute('user123', updateDTO) // Pass userId

    expect(updatedGallery).toBeNull()

    // Ensure the gallery item was not updated
    const gallery = await galleryRepository.findById('gal123')
    expect(gallery?.imagePath).toBe('http://example.com/original.jpg')
  })
})
