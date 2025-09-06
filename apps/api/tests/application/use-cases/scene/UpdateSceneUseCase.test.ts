import type { Scene } from '@domain/entities/Scene'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'

import { UpdateSceneUseCase } from '@application/use-cases/scene/UpdateSceneUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

// Mock implementations
class MockSceneRepository implements ISceneRepository {
  private scenes: Scene[] = []

  async findById(id: string): Promise<Scene | null> {
    return this.scenes.find((scene) => scene.id === id) || null
  }

  async findByChapterId(chapterId: string): Promise<Scene[]> {
    return this.scenes.filter((scene) => scene.chapterId === chapterId)
  }

  async save(scene: Scene): Promise<void> {
    this.scenes.push(scene)
  }

  async update(scene: Scene): Promise<void> {
    const index = this.scenes.findIndex((s) => s.id === scene.id)
    if (index !== -1) {
      this.scenes[index] = scene
    }
  }

  async delete(id: string): Promise<void> {
    this.scenes = this.scenes.filter((scene) => scene.id !== id)
  }
}

// Mock for IChapterRepository
const mockChapterRepository = {
  findById: vi.fn(),
  findByStoryId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

// Mock for IStoryRepository
const mockStoryRepository = {
  findById: vi.fn(),
  findByUserId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

// Mock for IChoiceRepository
const mockChoiceRepository = {
  findById: vi.fn(),
  findBySceneId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

// Mock for ILocationRepository
const mockLocationRepository = {
  findById: vi.fn(),
  findByStoryId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

describe('UpdateSceneUseCase', () => {
  let sceneRepository: MockSceneRepository
  let updateSceneUseCase: UpdateSceneUseCase

  beforeEach(() => {
    sceneRepository = new MockSceneRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockChapterRepository.findById.mockImplementation((id: string) => {
      if (id === 'chapter123') {
        return { id: id, storyId: 'story123', name: 'Chapter 1', index: 1 } // Added chapterId
      }
      return null
    })
    mockStoryRepository.findById.mockResolvedValue({
      id: 'story123',
      userId: 'user123',
      type: 'linear',
    })
    mockLocationRepository.findById.mockImplementation((id: string) => {
      if (id === 'loc123') return { id: 'loc123', storyId: 'story123' } // Added storyId
      return null
    })

    updateSceneUseCase = new UpdateSceneUseCase(
      sceneRepository,
      mockChoiceRepository,
      mockStoryRepository,
      mockChapterRepository,
      mockLocationRepository, // Added
    )

    // Pre-populate a scene for testing
    sceneRepository.save({
      id: 'scene123',
      chapterId: 'chapter123',
      locationId: 'loc123',
      name: 'Original Scene Name',
      index: 1,
      summary: 'Original Summary',
      gap: '1 hour',
      duration: '30 minutes',
      isFavorite: false,
      extraNotes: 'Original Notes',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should update an existing scene successfully', async () => {
    const updateDTO = {
      id: 'scene123',
      name: 'Updated Scene Name',
      index: 2,
      isFavorite: true,
    }

    const updatedScene = await updateSceneUseCase.execute('user123', updateDTO) // Pass userId

    expect(updatedScene).toBeDefined()
    expect(updatedScene?.name).toBe('Updated Scene Name')
    expect(updatedScene?.index).toBe(2)
    expect(updatedScene?.isFavorite).toBe(true)
    expect(updatedScene?.summary).toBe('Original Summary') // Should remain unchanged
  })

  it('should return null if scene not found', async () => {
    const updateDTO = {
      id: 'nonexistent_scene',
      name: 'New Name',
    }

    const updatedScene = await updateSceneUseCase.execute('user123', updateDTO) // Pass userId

    expect(updatedScene).toBeNull()
  })

  it('should throw an error if chapter not found for scene', async () => {
    mockChapterRepository.findById.mockResolvedValue(null) // Mock chapter not found

    const updateDTO = {
      id: 'scene123',
      name: 'New Name',
    }

    await expect(updateSceneUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Chapter not found',
    )
  })

  it('should throw an error if story not found or not owned by user for scene', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    const updateDTO = {
      id: 'scene123',
      name: 'New Name',
    }

    await expect(updateSceneUseCase.execute('user123', updateDTO)).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
