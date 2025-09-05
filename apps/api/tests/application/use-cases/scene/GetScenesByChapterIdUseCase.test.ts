import type { Scene } from '@domain/entities/Scene'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { GetScenesByChapterIdUseCase } from '@application/use-cases/scene/GetScenesByChapterIdUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

// Mock implementation
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

describe('GetScenesByChapterIdUseCase', () => {
  let sceneRepository: MockSceneRepository
  let getScenesByChapterIdUseCase: GetScenesByChapterIdUseCase

  beforeEach(() => {
    sceneRepository = new MockSceneRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockChapterRepository.findById.mockImplementation((id: string) => {
      if (id === 'chapter123' || id === 'chapter456') {
        return { id: id, storyId: 'story123', name: 'Chapter 1', index: 1 } // Added storyId
      }
      return null
    })
    mockStoryRepository.findById.mockResolvedValue({ id: 'story123', userId: 'user123', type: 'linear' })

    getScenesByChapterIdUseCase = new GetScenesByChapterIdUseCase(
      sceneRepository,
      mockChapterRepository, // Added
      mockStoryRepository, // Added
    )

    // Pre-populate scenes for testing
    sceneRepository.save({
      id: 'scene1',
      chapterId: 'chapter123',
      name: 'Scene 1',
      index: 1,
      summary: null,
      gap: null,
      duration: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    sceneRepository.save({
      id: 'scene2',
      chapterId: 'chapter123',
      name: 'Scene 2',
      index: 2,
      summary: null,
      gap: null,
      duration: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    sceneRepository.save({
      id: 'scene3',
      chapterId: 'chapter456',
      name: 'Scene 3',
      index: 1,
      summary: null,
      gap: null,
      duration: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should return all scenes for a given chapter ID', async () => {
    const scenes = await getScenesByChapterIdUseCase.execute('user123', 'chapter123') // Pass userId

    expect(scenes).toBeDefined()
    expect(scenes.length).toBe(2)
    expect(scenes[0].name).toBe('Scene 1')
    expect(scenes[1].name).toBe('Scene 2')
  })

  it('should return an empty array if no scenes found for the chapter ID', async () => {
    const scenes = await getScenesByChapterIdUseCase.execute('user123', 'nonexistent_chapter') // Pass userId

    expect(scenes).toBeDefined()
    expect(scenes.length).toBe(0)
  })

  it('should throw an error if chapter not found or not owned by user', async () => {
    mockChapterRepository.findById.mockResolvedValue(null) // Mock chapter not found

    await expect(getScenesByChapterIdUseCase.execute('user123', 'nonexistent_chapter')).rejects.toThrow(
      'Chapter not found',
    )
  })

  it('should throw an error if story not found or not owned by user for chapter', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    await expect(getScenesByChapterIdUseCase.execute('user123', 'chapter123')).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
