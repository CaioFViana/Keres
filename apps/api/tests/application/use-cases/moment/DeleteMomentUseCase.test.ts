import type { Moment } from '@domain/entities/Moment'
import type { IMomentRepository } from '@domain/repositories/IMomentRepository'

import { DeleteMomentUseCase } from '@application/use-cases/moment/DeleteMomentUseCase'
import { beforeEach, describe, expect, it } from 'vitest'

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

describe('DeleteMomentUseCase', () => {
  let momentRepository: MockMomentRepository
  let deleteMomentUseCase: DeleteMomentUseCase

  beforeEach(() => {
    momentRepository = new MockMomentRepository()
    deleteMomentUseCase = new DeleteMomentUseCase(momentRepository)

    // Pre-populate a moment for testing
    momentRepository.save({
      id: 'moment123',
      sceneId: 'scene123',
      name: 'Moment to Delete',
      location: null,
      index: 1,
      summary: null,
      isFavorite: false,
      extraNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  })

  it('should delete an existing moment successfully', async () => {
    const deleted = await deleteMomentUseCase.execute('moment123', 'scene123')
    expect(deleted).toBe(true)

    const moment = await momentRepository.findById('moment123')
    expect(moment).toBeNull()
  })

  it('should return false if moment not found', async () => {
    const deleted = await deleteMomentUseCase.execute('nonexistent_moment', 'scene123')
    expect(deleted).toBe(false)
  })

  it('should return false if moment does not belong to the specified scene', async () => {
    const deleted = await deleteMomentUseCase.execute('moment123', 'another_scene')
    expect(deleted).toBe(false)

    // Ensure the moment was not deleted
    const moment = await momentRepository.findById('moment123')
    expect(moment).toBeDefined()
  })
})
