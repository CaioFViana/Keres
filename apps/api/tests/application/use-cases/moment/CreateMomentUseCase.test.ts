import type { Moment } from '@domain/entities/Moment'
import type { IChapterRepository } from '@domain/repositories/IChapterRepository' // Added
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'
import type { ISceneRepository } from '@domain/repositories/ISceneRepository' // Added
import type { IStoryRepository } from '@domain/repositories/IStoryRepository' // Added

import { CreateMomentUseCase } from '@application/use-cases/moment/CreateMomentUseCase'
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

describe('CreateMomentUseCase', () => {
  let momentRepository: MockMomentRepository
  let createMomentUseCase: CreateMomentUseCase

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

    createMomentUseCase = new CreateMomentUseCase(
      momentRepository,
      mockSceneRepository, // Added
      mockChapterRepository, // Added
      mockStoryRepository, // Added
    )
  })

  it('should create a new moment successfully', async () => {
    const momentDTO = {
      sceneId: 'scene123',
      name: 'Moment 1',
      location: 'Location A',
      index: 1,
      summary: 'A summary.',
      isFavorite: true,
      extraNotes: 'Some extra notes.',
    }

    const momentProfile = await createMomentUseCase.execute('user123', momentDTO) // Pass userId

    expect(momentProfile).toBeDefined()
    expect(momentProfile.name).toBe('Moment 1')
    expect(momentProfile.sceneId).toBe('scene123')
    expect(momentProfile.id).toBeDefined()
    expect(momentProfile.isFavorite).toBe(true)

    const createdMoment = await momentRepository.findById(momentProfile.id)
    expect(createdMoment).toBeDefined()
    expect(createdMoment?.name).toBe('Moment 1')
  })

  it('should create a new moment with default values for optional fields', async () => {
    const momentDTO = {
      sceneId: 'scene456',
      name: 'Moment 2',
      index: 2,
    }

    const momentProfile = await createMomentUseCase.execute('user123', momentDTO) // Pass userId

    expect(momentProfile).toBeDefined()
    expect(momentProfile.name).toBe('Moment 2')
    expect(momentProfile.location).toBeNull()
    expect(momentProfile.summary).toBeNull()
    expect(momentProfile.isFavorite).toBe(false)
    expect(momentProfile.extraNotes).toBeNull()
  })

  it('should throw an error if scene not found', async () => {
    mockSceneRepository.findById.mockResolvedValue(null) // Mock scene not found

    const momentDTO = {
      sceneId: 'nonexistent_scene',
      name: 'Moment 3',
      index: 3,
    }

    await expect(createMomentUseCase.execute('user123', momentDTO)).rejects.toThrow(
      'Scene not found',
    )
  })

  it('should throw an error if chapter not found for scene', async () => {
    mockChapterRepository.findById.mockResolvedValue(null) // Mock chapter not found

    const momentDTO = {
      sceneId: 'scene123',
      name: 'Moment 4',
      index: 4,
    }

    await expect(createMomentUseCase.execute('user123', momentDTO)).rejects.toThrow(
      'Chapter not found',
    )
  })

  it('should throw an error if story not found or not owned by user for scene', async () => {
    mockStoryRepository.findById.mockResolvedValue(null) // Mock story not found

    const momentDTO = {
      sceneId: 'scene123',
      name: 'Moment 5',
      index: 5,
    }

    await expect(createMomentUseCase.execute('user123', momentDTO)).rejects.toThrow(
      'Story not found or not owned by user',
    )
  })
})
