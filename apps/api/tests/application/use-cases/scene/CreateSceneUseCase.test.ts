import type { Scene } from '@domain/entities/Scene'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository'
import type { IChoiceRepository } from '@domain/repositories/IChoiceRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IStoryRepository } from '@domain/repositories/IStoryRepository'
import type { ILocationRepository } from '@domain/repositories/ILocationRepository' // Added

import { CreateSceneUseCase } from '@application/use-cases/scene/CreateSceneUseCase'
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

describe('CreateSceneUseCase', () => {
  let sceneRepository: MockSceneRepository
  let createSceneUseCase: CreateSceneUseCase

  beforeEach(() => {
    sceneRepository = new MockSceneRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockChapterRepository.findById.mockImplementation((id: string) => {
      if (id === 'chapter123' || id === 'chapter456') {
        return { id: id, storyId: 'story123', name: 'Chapter 1', index: 1 }
      }
      return null
    })
    mockStoryRepository.findById.mockResolvedValue({ id: 'story123', userId: 'user123', type: 'linear' })
    mockLocationRepository.findById.mockImplementation((id: string) => {
      if (id === 'loc123') return { id: 'loc123', storyId: 'story123' }
      return null
    })

    createSceneUseCase = new CreateSceneUseCase(
      sceneRepository,
      mockChoiceRepository,
      mockStoryRepository,
      mockChapterRepository,
      mockLocationRepository, // Added
    )
  })

  it('should create a new scene successfully', async () => {
    const sceneDTO = {
      chapterId: 'chapter123',
      locationId: 'loc123',
      name: 'Scene 1',
      index: 1,
      summary: 'A summary.',
      gap: '1 day',
      duration: '2 hours',
      isFavorite: true,
      extraNotes: 'Some extra notes.',
    }

    const sceneProfile = await createSceneUseCase.execute('user123', sceneDTO) // Pass userId

    expect(sceneProfile).toBeDefined()
    expect(sceneProfile.name).toBe('Scene 1')
    expect(sceneProfile.chapterId).toBe('chapter123')
    expect(sceneProfile.locationId).toBe('loc123')
    expect(sceneProfile.id).toBeDefined()
    expect(sceneProfile.isFavorite).toBe(true)

    const createdScene = await sceneRepository.findById(sceneProfile.id)
    expect(createdScene).toBeDefined()
    expect(createdScene?.name).toBe('Scene 1')
  })

  it('should create a new scene with default values for optional fields', async () => {
    const sceneDTO = {
      chapterId: 'chapter456',
      locationId: 'loc123',
      name: 'Scene 2',
      index: 2,
    }

    const sceneProfile = await createSceneUseCase.execute('user123', sceneDTO) // Pass userId

    expect(sceneProfile).toBeDefined()
    expect(sceneProfile.name).toBe('Scene 2')
    expect(sceneProfile.summary).toBeNull()
    expect(sceneProfile.gap).toBeNull()
    expect(sceneProfile.duration).toBeNull()
    expect(sceneProfile.isFavorite).toBe(false)
    expect(sceneProfile.extraNotes).toBeNull()
  })

  it('should throw an error if chapter not found', async () => {
    mockChapterRepository.findById.mockResolvedValue(null) // Mock chapter not found

    const sceneDTO = {
      chapterId: 'nonexistent_chapter',
      locationId: 'loc123',
      name: 'Scene 3',
      index: 3,
    }

    await expect(createSceneUseCase.execute('user123', sceneDTO)).rejects.toThrow('Chapter not found')
  })

  it('should throw an error if story not found or not owned by user', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    const sceneDTO = {
      chapterId: 'chapter123',
      locationId: 'loc123',
      name: 'Scene 4',
      index: 4,
    }

    await expect(createSceneUseCase.execute('user123', sceneDTO)).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })

  it('should throw an error if location not found', async () => {
    mockLocationRepository.findById.mockResolvedValue(null) // Mock location not found

    const sceneDTO = {
      chapterId: 'chapter123',
      locationId: 'nonexistent_loc',
      name: 'Scene 5',
      index: 5,
    }

    await expect(createSceneUseCase.execute('user123', sceneDTO)).rejects.toThrow('Location not found')
  })

  it('should throw an error if location does not belong to the same story as the chapter', async () => {
    mockLocationRepository.findById.mockResolvedValue({ id: 'loc_other_story', storyId: 'other_story' }) // Mock location from another story

    const sceneDTO = {
      chapterId: 'chapter123',
      locationId: 'loc_other_story',
      name: 'Scene 6',
      index: 6,
    }

    await expect(createSceneUseCase.execute('user123', sceneDTO)).rejects.toThrow(
      'Location does not belong to the same story as the chapter',
    )
  })
})
