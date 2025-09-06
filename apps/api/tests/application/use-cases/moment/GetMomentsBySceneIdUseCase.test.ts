import type { Moment } from '@domain/entities/Moment'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Added
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { GetMomentsBySceneIdUseCase } from '@application/use-cases/moment/GetMomentsBySceneIdUseCase'
import { beforeEach, describe, expect, it, vi } from 'vitest' // Added vi

// Mock implementation
class MockMomentRepository implements IMomentRepository {
  private moments: Moment[] = []

  async findById(id: string): Promise<Moment | null> {
    return this.moments.find((moment) => moment.id === id) || null
  }

  async findBySceneId(sceneId: string): Promise<Moment[]> {
    return this.moments.filter((moment) => moment.sceneId === sceneId)
  }

  async save(moment: Moment): Promise<void> {
    this.moments.push(moment)
  }

  async update(moment: Moment): Promise<void> {
    const index = this.moments.findIndex((m) => m.id === moment.id)
    if (index !== -1) {
      this.moments[index] = moment
    }
  }

  async delete(id: string): Promise<void> {
    this.moments = this.moments.filter((moment) => moment.id !== id)
  }
}

// Mock for ISceneRepository
const mockSceneRepository = {
  findById: vi.fn(),
  findByChapterId: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
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

describe('GetMomentsBySceneIdUseCase', () => {
  let momentRepository: MockMomentRepository
  let getMomentsBySceneIdUseCase: GetMomentsBySceneIdUseCase

  beforeEach(() => {
    momentRepository = new MockMomentRepository()
    // Reset mocks before each test
    vi.clearAllMocks()

    // Setup mock return values for dependencies
    mockSceneRepository.findById.mockImplementation((id: string) => {
      if (id === 'scene123' || id === 'scene456') {
        return { id: id, chapterId: 'chapter123', name: 'Scene 1', index: 1 } // Added chapterId
      }
      return null
    })
    mockChapterRepository.findById.mockResolvedValue({
      id: 'chapter123',
      storyId: 'story123',
      name: 'Chapter 1',
    })
    mockStoryRepository.findById.mockResolvedValue({
      id: 'story123',
      userId: 'user123',
      type: 'linear',
    })

    getMomentsBySceneIdUseCase = new GetMomentsBySceneIdUseCase(
      momentRepository,
      mockSceneRepository, // Added
      mockChapterRepository, // Added
      mockStoryRepository, // Added
    )

    // Pre-populate moments for testing
    momentRepository.save({
      id: 'moment1',
      sceneId: 'scene123',
      name: 'Moment 1',
      location: 'Location A',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    momentRepository.save({
      id: 'moment2',
      sceneId: 'scene123',
      name: 'Moment 2',
      location: 'Location B',
      index: 2,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    momentRepository.save({
      id: 'moment3',
      sceneId: 'scene456',
      name: 'Moment 3',
      location: 'Location C',
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should return all moments for a given scene ID', async () => {
    const moments = await getMomentsBySceneIdUseCase.execute('user123', 'scene123') // Pass userId

    expect(moments).toBeDefined()
    expect(moments.length).toBe(2)
    expect(moments[0].name).toBe('Moment 1')
    expect(moments[1].name).toBe('Moment 2')
  })

  it('should return an empty array if no moments found for the scene ID', async () => {
    const moments = await getMomentsBySceneIdUseCase.execute('user123', 'nonexistent_scene') // Pass userId

    expect(moments).toBeDefined()
    expect(moments.length).toBe(0)
  })

  it('should throw an error if scene not found or not owned by user', async () => {
    mockSceneRepository.findById.mockResolvedValue(null) // Mock scene not found

    await expect(
      getMomentsBySceneIdUseCase.execute('user123', 'nonexistent_scene'),
    ).rejects.toThrow('Scene not found')
  })

  it('should throw an error if chapter not found for scene', async () => {
    mockChapterRepository.findById.mockResolvedValue(null) // Mock chapter not found

    await expect(getMomentsBySceneIdUseCase.execute('user123', 'scene123')).rejects.toThrow(
      'Chapter not found',
    )
  })

  it('should throw an error if story not found or not owned by user for scene', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    await expect(getMomentsBySceneIdUseCase.execute('user123', 'scene123')).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
